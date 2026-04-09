import type { CardBreakdown } from "@/lib/calculator";
import { getAnalyticsIdentityContext } from "@/lib/analytics";

/** 選卡／結果區共用：試算當下的卡片分攤與總淨回饋，供 alpha 與 OSP 計算 */
export type CardEngagementSnapshot = {
  cardBreakdown: CardBreakdown[];
  totalNetCashback: number;
  model_alpha?: number;
  n_calc?: number;
};

const ANON_STORAGE_KEY = "jp_calc_anonymous_uid";
const SESSION_STORAGE_KEY = "jp_calc_session_id";

export type CardEngagementType = "Identity_Confirmation" | "Offer_Deep_Dive";

function safeRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** 匿名裝置 ID（localStorage）與分頁工作階段 ID（sessionStorage），供 GA4／Mixpanel 關聯 */
export function getEngagementIdentity(): { anonymous_uid: string; session_id: string } {
  if (typeof window === "undefined") {
    return { anonymous_uid: "", session_id: "" };
  }
  try {
    let anonymous_uid = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (!anonymous_uid) {
      anonymous_uid = safeRandomId();
      window.localStorage.setItem(ANON_STORAGE_KEY, anonymous_uid);
    }
    let session_id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!session_id) {
      session_id = safeRandomId();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, session_id);
    }
    return { anonymous_uid, session_id };
  } catch {
    return { anonymous_uid: "", session_id: "" };
  }
}

/**
 * OSP 代理指標（0–100）：目前水庫淨回饋在「有回饋的卡片」上的分配集中度（HHI×100）。
 * 數值愈高代表試算結果愈集中在少數卡／單一路徑，可作為「最優解偏執度」之保守 proxy。
 */
export function computeOspIndex(cardBreakdown: CardBreakdown[], totalNetCashback: number): number {
  if (totalNetCashback <= 0.01 || !cardBreakdown.length) return 0;
  const nets = cardBreakdown.filter((c) => c.netCashback > 0.01).map((c) => c.netCashback);
  if (nets.length === 0) return 0;
  const sum = nets.reduce((a, b) => a + b, 0);
  if (sum <= 0.01) return 0;
  const hhi = nets.reduce((acc, n) => acc + (n / sum) ** 2, 0);
  return Math.min(100, Math.round(hhi * 100));
}

/** 依目前最優解分配：該卡分攤淨回饋；若無則可用 fallback（例如辦卡列之單卡試算） */
export function getIndividualAlpha(
  cardId: string,
  cardBreakdown: CardBreakdown[],
  fallbackAlpha?: number
): number {
  const row = cardBreakdown.find((c) => c.cardId === cardId);
  let v = row?.netCashback ?? 0;
  if (v <= 0 && fallbackAlpha != null && Number.isFinite(fallbackAlpha)) {
    v = fallbackAlpha;
  }
  return Math.round(v);
}

/** 依淨回饋排序後，該卡在當前試算中的「省錢位次」（1=最高） */
export function rankPositionByNetInBreakdown(
  cardId: string,
  cardBreakdown: CardBreakdown[]
): number | null {
  if (!cardBreakdown.length) return null;
  const sorted = [...cardBreakdown].sort((a, b) => b.netCashback - a.netCashback);
  const idx = sorted.findIndex((c) => c.cardId === cardId);
  return idx >= 0 ? idx + 1 : null;
}

export interface CardDetailEngagementPayload {
  card_id: string;
  card_name: string;
  engagement_type: CardEngagementType;
  individual_alpha: number;
  osp_index_at_click: number;
  /** 建議清單中的排序（1-based）；無清單語意時可為 null */
  rank_position: number | null;
  anonymous_uid: string;
  session_id: string;
  referral_source_id: string;
  model_alpha: number;
  n_calc: number;
}

let runtimeEngagementContext: { model_alpha: number; n_calc: number } = {
  model_alpha: 0,
  n_calc: 0,
};

export function setEngagementRuntimeContext(ctx: {
  model_alpha?: number;
  n_calc?: number;
}): void {
  runtimeEngagementContext = {
    model_alpha: Number(ctx.model_alpha ?? runtimeEngagementContext.model_alpha ?? 0),
    n_calc: Math.max(0, Math.floor(ctx.n_calc ?? runtimeEngagementContext.n_calc ?? 0)),
  };
}

/**
 * 統一信用卡外連點擊事件：Card_Detail_Engagement
 * — GA4 gtag、dataLayer、Mixpanel（若已載入 mixpanel）
 */
export function trackCardDetailEngagement(params: {
  cardId: string;
  cardName: string;
  engagement_type: CardEngagementType;
  individual_alpha: number;
  osp_index_at_click: number;
  rank_position: number | null;
  model_alpha?: number;
  n_calc?: number;
}): void {
  if (typeof window === "undefined") return;
  const identity = getAnalyticsIdentityContext();
  const { anonymous_uid, session_id } = getEngagementIdentity();
  const payload: CardDetailEngagementPayload = {
    card_id: params.cardId,
    card_name: params.cardName,
    engagement_type: params.engagement_type,
    individual_alpha: params.individual_alpha,
    osp_index_at_click: params.osp_index_at_click,
    rank_position: params.rank_position,
    anonymous_uid: identity.Anonymous_UID || anonymous_uid,
    session_id: identity.Session_ID || session_id,
    referral_source_id: identity.Referral_Source_ID || "direct",
    model_alpha: Number(params.model_alpha ?? runtimeEngagementContext.model_alpha ?? 0),
    n_calc: Math.max(0, Math.floor(params.n_calc ?? runtimeEngagementContext.n_calc ?? 0)),
  };

  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
    mixpanel?: { track?: (name: string, props: Record<string, unknown>) => void };
  };

  if (typeof w.gtag === "function") {
    w.gtag("event", "Card_Detail_Engagement", {
      engagement_type: payload.engagement_type,
      individual_alpha: payload.individual_alpha,
      osp_index_at_click: payload.osp_index_at_click,
      rank_position: payload.rank_position ?? undefined,
      card_id: payload.card_id,
      card_name: payload.card_name,
      anonymous_uid: payload.anonymous_uid || undefined,
      session_id: payload.session_id || undefined,
      referral_source_id: payload.referral_source_id || undefined,
      model_alpha: payload.model_alpha,
      n_calc: payload.n_calc,
    });
  }

  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({
    event: "Card_Detail_Engagement",
    ...payload,
  });

  if (typeof w.mixpanel?.track === "function") {
    w.mixpanel.track("Card_Detail_Engagement", payload as unknown as Record<string, unknown>);
  }
}
