"use client";

const ANONYMOUS_UID_KEY = "anonymous_uid";
const SESSION_ID_KEY = "session_id";
const SESSION_LAST_SEEN_KEY = "session_last_seen_at";
const REFERRAL_SOURCE_KEY = "referral_source_id";
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 分鐘

type BrowserWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  mixpanel?: {
    register?: (props: Record<string, unknown>) => void;
    track?: (event: string, props?: Record<string, unknown>) => void;
    people?: { set?: (props: Record<string, unknown>) => void };
  };
};

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function simpleHash(input: string): string {
  let h1 = 0x811c9dc5; // FNV-ish seed
  for (let i = 0; i < input.length; i += 1) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0");
}

function buildBrowserFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const screenInfo =
    typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "";
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(navigator.hardwareConcurrency ?? ""),
    String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
    tz,
    screenInfo,
  ].join("|");
  return `fp_${simpleHash(raw)}`;
}

/**
 * 取得匿名使用者識別碼：
 * - 優先使用瀏覽器指紋摘要（穩定且不需額外權限）
 * - 若不可用則退回 UUID
 */
export function getAnonymousUID(): string {
  if (!canUseBrowserStorage()) return "";
  try {
    const existing = window.localStorage.getItem(ANONYMOUS_UID_KEY);
    if (existing) return existing;

    const fingerprintId = buildBrowserFingerprint();
    const next = fingerprintId || safeUuid();
    window.localStorage.setItem(ANONYMOUS_UID_KEY, next);
    return next;
  } catch {
    return "";
  }
}

/**
 * 取得 Session ID，具 30 分鐘閒置過期邏輯：
 * - 無 session 或超過 30 分鐘未活動 => 產生新 Session_ID
 * - 每次呼叫都會刷新最後活動時間
 */
export function getSessionID(now = Date.now()): string {
  if (!canUseBrowserStorage()) return "";
  try {
    const currentId = window.sessionStorage.getItem(SESSION_ID_KEY);
    const lastSeenRaw = window.sessionStorage.getItem(SESSION_LAST_SEEN_KEY);
    const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : 0;
    const expired = !lastSeen || now - lastSeen > SESSION_IDLE_TIMEOUT_MS;

    const nextId = !currentId || expired ? safeUuid() : currentId;
    window.sessionStorage.setItem(SESSION_ID_KEY, nextId);
    window.sessionStorage.setItem(SESSION_LAST_SEEN_KEY, String(now));
    return nextId;
  } catch {
    return "";
  }
}

/**
 * 來源歸因：
 * - URL `ref` 優先，其次 `utm_source`
 * - 若本次 URL 無參數，回傳先前儲存值，否則 fallback `direct`
 */
export function getReferralSourceID(): string {
  if (!canUseBrowserStorage()) return "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ref") || params.get("utm_source");
    if (fromUrl && fromUrl.trim()) {
      window.localStorage.setItem(REFERRAL_SOURCE_KEY, fromUrl.trim());
      return fromUrl.trim();
    }
    return window.localStorage.getItem(REFERRAL_SOURCE_KEY) || "direct";
  } catch {
    return "direct";
  }
}

export type AnalyticsIdentityContext = {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
};

export type BudgetSnapshot = {
  flight_budget: number;
  hotel_budget: number;
  rental_budget: number;
  local_budget: number;
  total_budget: number;
  intent_score: number;
  dominant_intent_category: "flight" | "hotel" | "rental" | "local" | "none";
  hotel_ratio: number;
  transport_ratio: number;
  alpha: number;
  n_calc: number;
};

export function getAnalyticsIdentityContext(): AnalyticsIdentityContext {
  return {
    Anonymous_UID: getAnonymousUID(),
    Session_ID: getSessionID(),
    Referral_Source_ID: getReferralSourceID(),
  };
}

/**
 * 將全域身份／來源屬性一次同步至：
 * - Mixpanel Super Properties
 * - GA4 User Properties
 */
export function syncGlobalAnalyticsProperties(): AnalyticsIdentityContext {
  const context = getAnalyticsIdentityContext();
  if (typeof window === "undefined") return context;

  const w = window as BrowserWindow;
  const sharedProps = {
    Anonymous_UID: context.Anonymous_UID || undefined,
    Session_ID: context.Session_ID || undefined,
    Referral_Source_ID: context.Referral_Source_ID || undefined,
  };

  if (typeof w.mixpanel?.register === "function") {
    w.mixpanel.register(sharedProps);
  }
  if (typeof w.mixpanel?.people?.set === "function") {
    w.mixpanel.people.set(sharedProps);
  }

  if (typeof w.gtag === "function") {
    w.gtag("set", "user_properties", sharedProps);
  }

  return context;
}

function resolveDominantIntentCategory(snapshot: Omit<BudgetSnapshot, "dominant_intent_category">): BudgetSnapshot["dominant_intent_category"] {
  const scores: Array<{ key: "flight" | "hotel" | "rental" | "local"; value: number }> = [
    { key: "flight", value: snapshot.flight_budget },
    { key: "hotel", value: snapshot.hotel_budget },
    { key: "rental", value: snapshot.rental_budget },
    { key: "local", value: snapshot.local_budget },
  ];
  scores.sort((a, b) => b.value - a.value);
  return scores[0].value > 0 ? scores[0].key : "none";
}

/**
 * 階段二：預算快照與特徵意圖事件
 * - 事件名：budget_calculated
 * - 送往：Mixpanel、GA4、dataLayer
 * - 自動貼標：飯店平台高敏感者 / Suica/ICOCA 頻繁使用者
 */
export function trackBudgetCalculated(input: {
  flight: number;
  hotel: number;
  rental: number;
  local: number;
  alpha?: number;
  n_calc?: number;
}): BudgetSnapshot {
  const flight = Math.max(0, Math.round(input.flight || 0));
  const hotel = Math.max(0, Math.round(input.hotel || 0));
  const rental = Math.max(0, Math.round(input.rental || 0));
  const local = Math.max(0, Math.round(input.local || 0));
  const total = flight + hotel + rental + local;
  const maxOne = Math.max(flight, hotel, rental, local);
  const intentScore = total > 0 ? Number((maxOne / total).toFixed(4)) : 0;
  const hotelRatio = total > 0 ? Number((hotel / total).toFixed(4)) : 0;
  const transportRatio = total > 0 ? Number((rental / total).toFixed(4)) : 0;

  const partial: Omit<BudgetSnapshot, "dominant_intent_category"> = {
    flight_budget: flight,
    hotel_budget: hotel,
    rental_budget: rental,
    local_budget: local,
    total_budget: total,
    intent_score: intentScore,
    hotel_ratio: hotelRatio,
    transport_ratio: transportRatio,
    alpha: Number(input.alpha ?? 0),
    n_calc: Math.max(0, Math.floor(input.n_calc ?? 0)),
  };

  const snapshot: BudgetSnapshot = {
    ...partial,
    dominant_intent_category: resolveDominantIntentCategory(partial),
  };

  if (typeof window === "undefined") return snapshot;
  const w = window as BrowserWindow & { dataLayer?: Record<string, unknown>[] };

  const identity = syncGlobalAnalyticsProperties();
  const payload: Record<string, unknown> = {
    ...snapshot,
    Anonymous_UID: identity.Anonymous_UID || undefined,
    Session_ID: identity.Session_ID || undefined,
    Referral_Source_ID: identity.Referral_Source_ID || undefined,
  };

  if (typeof w.gtag === "function") {
    w.gtag("event", "budget_calculated", payload);
  }
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event: "budget_calculated", ...payload });

  if (typeof w.mixpanel?.track === "function") {
    w.mixpanel.track("budget_calculated", payload);
  }

  if (typeof w.mixpanel?.people?.set === "function") {
    const peopleTags: Record<string, unknown> = {};
    if (hotelRatio > 0.4) peopleTags["飯店平台高敏感者"] = true;
    if (transportRatio > 0.2) peopleTags["Suica/ICOCA 頻繁使用者"] = true;
    if (Object.keys(peopleTags).length > 0) {
      w.mixpanel.people.set(peopleTags);
    }
  }

  return snapshot;
}

