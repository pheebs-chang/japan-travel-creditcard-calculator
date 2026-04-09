import {
  CreditCard,
  SpendingCategory,
  FOREIGN_FEE,
  CashbackRule,
  DBS_ECO_EXCLUDED_BRANDS,
  SINOPAC_MAX_SPENDING_FOR_BONUS,
  SINOPAC_NEW_USER_PROMO_CAP_TWD,
} from "./card-data";
import {
  SPENDING_PATTERNS,
  HOTEL_BOOKING_BRANDS,
  FLIGHT_BOOKING_BRANDS,
  type SpendingPattern,
  type BrandItem,
} from "./spend-patterns";

function findBrandInPattern(pattern: SpendingPattern, brandId: string): BrandItem | undefined {
  if (pattern.brands) {
    const b = pattern.brands.find((x) => x.id === brandId);
    if (b) return b;
  }
  if (pattern.subGroups) {
    for (const sg of pattern.subGroups) {
      const b = sg.brands.find((x) => x.id === brandId);
      if (b) return b;
    }
  }
  return undefined;
}

/** 支付方式：影響中信 UniOpen 線上／實體試算與攻略標籤 */
export type PaymentChannel = "physical" | "apple_pay" | "online";

/** 單筆住宿訂單（多間飯店分開填寫，各自為不可分割的一筆） */
export interface AccommodationExpense {
  id: string;
  name: string;
  amount: number;
  platform?: string;
  /** 預設：線上訂房 */
  paymentMethod?: PaymentChannel;
}

/** 國內機捷／高鐵購票試算：分開刷卡或一人代購（影響每人回饋上限與拆段試算） */
export type DomesticRailPurchaseMode = "split" | "together";

export interface SpendingInput {
  flight: number;
  accommodationExpenses: AccommodationExpense[];
  rental: number;
  local: number;
  /** Step2 機票區塊：預設線上 */
  flightPaymentMethod?: PaymentChannel;
  /** 機票購買方式：split 依人數拆分逐人試算；together 以總額單筆試算。 */
  flightPurchaseMode?: DomesticRailPurchaseMode;
  /**
   * @deprecated 舊版單一開關，僅作為 `taiwanHsrPurchaseMode` 之後備（新 UI 請用下列兩欄）。
   * `split`：高鐵預設為分開買；機捷預設仍為一起買。
   */
  domesticRailPurchaseMode?: DomesticRailPurchaseMode;
  /** 桃園機場捷運：已固定採 split（依人數拆分逐人試算）。 */
  taoyuanMetroPurchaseMode?: DomesticRailPurchaseMode;
  /** 台灣高鐵：`split` 時以 (金額÷人數) 逐人試算後加總。未指定時後備為 `domesticRailPurchaseMode`。 */
  taiwanHsrPurchaseMode?: DomesticRailPurchaseMode;
}

/** 依類別／樣態的預設支付方式（UI 新增列時使用） */
export function defaultPaymentForPattern(
  category: SpendingCategory,
  patternId?: string,
  patternLabel?: string
): PaymentChannel {
  if (category === "flight" || category === "hotel") return "online";
  if (category === "rental") return "online";
  if (patternId === "transport") return "apple_pay";
  if (patternId === "domestic_transport") return "physical";
  if (patternLabel && /購物|百貨|outlet|藥妝/i.test(patternLabel)) return "physical";
  if (patternLabel && /餐飲|美食/i.test(patternLabel)) return "physical";
  return "physical";
}

export function totalAccommodationAmount(sp: SpendingInput): number {
  return (sp.accommodationExpenses ?? []).reduce((s, e) => s + (e.amount || 0), 0);
}

function newPatternExpenseId(patternId: string): string {
  return `pat-${patternId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface TravelDateRange {
  from?: string;
  to?: string;
}

/** 將 YYYY-MM-DD 以本地日曆解析，避免 UTC 造成差一天 */
function parseYmdLocal(ymd: string | undefined): Date | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d);
}

// Track which brands are selected per pattern
export interface PatternSelection {
  patternId: string;
  brandId?: string;
  brandName?: string;
  category?: SpendingCategory;
  amount: number;
  isKumamonEligible: boolean;
  isRakutenJapanese?: boolean;  // for Kumamon hotel special logic
  isDbsEcoExcluded?: boolean;   // excluded from DBS eco 4% bonus
  isKkday?: boolean;            // purchased via KKday platform
  specialNote?: string;
  expenseId?: string;
  expenseName?: string;
  /** Step3 類別標題（如：購物消費、交通費用） */
  patternLabel?: string;
  /** 交通 IC：是否以 Apple Pay 儲值（影響 DBS／台新／富邦等判斷） */
  isApplePay?: boolean;
  /** 實體刷卡／Apple Pay／線上（Step2／Step3） */
  paymentMethod?: PaymentChannel;
  /** 機票按人頭拆票時：旅客索引 0,1,2…（僅 flight） */
  travelerIndex?: number;
}

// Merges pattern amounts into a SpendingInput by summing each category
// Also returns the list of pattern selections for card-specific logic
const IC_BRAND_IDS = new Set(["suica", "pasmo", "icoca", "jp_ic_wallet_topup"]);
const DOMESTIC_TRANSPORT_BRAND_IDS = new Set([
  "taoyuan_airport_metro",
  "taiwan_hsr_all",
  "taiwan_rail_all",
]);

export interface MergePatternPaymentOptions {
  flightPaymentMethod?: PaymentChannel;
  accommodationPaymentById?: Record<string, PaymentChannel>;
  /** key: `${patternId}:${brandId}` */
  patternPaymentByKey?: Record<string, PaymentChannel>;
}

export function mergePatternAmounts(
  base: SpendingInput,
  patternAmounts: Record<string, number>,
  selectedBrands?: Record<string, string>,
  baseFlightBrandId?: string | null,
  applePayByBrand?: Record<string, boolean>,
  paymentOpts?: MergePatternPaymentOptions,
  /** key: `domestic_transport:brandId`，用於機捷／高鐵分開試算 */
  patternBrandAmounts?: Record<string, number>
): { merged: SpendingInput; selections: PatternSelection[] } {
  const merged: SpendingInput = {
    ...base,
    accommodationExpenses: [...(base.accommodationExpenses ?? [])],
  };
  const selections: PatternSelection[] = [];

  for (const [patternId, amount] of Object.entries(patternAmounts)) {
    if (!amount || amount <= 0) continue;
    const pattern = SPENDING_PATTERNS.find((p) => p.id === patternId);
    if (!pattern) continue;

    // 國內交通：依品牌拆成多筆片段（機捷、高鐵各自金額與支付方式）
    if (pattern.id === "domestic_transport" && pattern.category === "local" && patternBrandAmounts) {
      const prefix = "domestic_transport:";
      const splits: { brandId: string; amt: number }[] = [];
      for (const [key, val] of Object.entries(patternBrandAmounts)) {
        if (!key.startsWith(prefix) || val == null || val <= 0.01) continue;
        splits.push({ brandId: key.slice(prefix.length), amt: val });
      }
      if (splits.length > 0) {
        const splitSum = splits.reduce((s, x) => s + x.amt, 0);
        merged.local = (merged.local ?? 0) + splitSum;
        for (const { brandId, amt } of splits) {
          const brand = findBrandInPattern(pattern, brandId);
          const bid = brandId;
          const isIc = IC_BRAND_IDS.has(bid);
          const isApplePay =
            isIc && bid
              ? bid === "jp_ic_wallet_topup"
                ? applePayByBrand?.jp_ic_wallet_topup ?? applePayByBrand?.suica ?? true
                : applePayByBrand?.[bid] ?? true
              : undefined;
          const segPm =
            paymentOpts?.patternPaymentByKey?.[`${pattern.id}:${bid}`] ??
            defaultPaymentForPattern("local", pattern.id, pattern.label);
          selections.push({
            patternId: pattern.id,
            brandId: bid,
            brandName: brand?.name,
            amount: amt,
            isKumamonEligible: brand?.isKumamonEligible ?? false,
            isRakutenJapanese: brand?.isRakutenJapanese ?? false,
            isDbsEcoExcluded: brand?.isDbsEcoExcluded ?? false,
            isKkday: brand?.isKkday ?? false,
            specialNote: brand?.specialNote,
            category: "local",
            patternLabel: pattern.label,
            isApplePay,
            paymentMethod: segPm,
          });
        }
        continue;
      }
    }

    // 一般品牌拆分：像 shopping 這類可複選品牌的 pattern，需逐品牌獨立入段，禁止合併成單一品牌。
    if (patternBrandAmounts) {
      const prefix = `${pattern.id}:`;
      const splitEntries = Object.entries(patternBrandAmounts)
        .filter(([key, val]) => key.startsWith(prefix) && (val ?? 0) > 0.01)
        .map(([key, val]) => ({ brandId: key.slice(prefix.length), amt: Number(val) || 0 }))
        .filter((x) => x.amt > 0.01);
      if (splitEntries.length > 0 && pattern.category !== "hotel") {
        const splitSum = splitEntries.reduce((s, x) => s + x.amt, 0);
        if (pattern.category === "flight") merged.flight = (merged.flight ?? 0) + splitSum;
        else if (pattern.category === "rental") merged.rental = (merged.rental ?? 0) + splitSum;
        else if (pattern.category === "local") merged.local = (merged.local ?? 0) + splitSum;

        for (const { brandId, amt } of splitEntries) {
          const brand = findBrandInPattern(pattern, brandId);
          const isIc = IC_BRAND_IDS.has(brandId);
          const isApplePay =
            isIc
              ? brandId === "jp_ic_wallet_topup"
                ? applePayByBrand?.jp_ic_wallet_topup ?? applePayByBrand?.suica ?? true
                : applePayByBrand?.[brandId] ?? true
              : undefined;
          const segPm =
            paymentOpts?.patternPaymentByKey?.[`${pattern.id}:${brandId}`] ??
            defaultPaymentForPattern(pattern.category, pattern.id, pattern.label);
          selections.push({
            patternId: pattern.id,
            brandId,
            brandName: brand?.name,
            amount: amt,
            isKumamonEligible: brand?.isKumamonEligible ?? false,
            isRakutenJapanese: brand?.isRakutenJapanese ?? false,
            isDbsEcoExcluded: brand?.isDbsEcoExcluded ?? false,
            isKkday: brand?.isKkday ?? false,
            specialNote: brand?.specialNote,
            category: pattern.category,
            patternLabel: pattern.label,
            isApplePay,
            paymentMethod: segPm,
          });
        }
        continue;
      }
    }

    if (pattern.category === "hotel") {
      const brandId = selectedBrands?.[patternId];
      let brand: any = brandId ? pattern.brands?.find((b) => b.id === brandId) : undefined;
      if (!brand && brandId && pattern.subGroups) {
        for (const sg of pattern.subGroups) {
          const found = sg.brands.find((b) => b.id === brandId);
          if (found) {
            brand = found;
            break;
          }
        }
      }
      const expId = newPatternExpenseId(patternId);
      const displayName = brand?.name ? `${pattern.label}（${brand.name}）` : pattern.label;
      const hotelPm =
        paymentOpts?.patternPaymentByKey?.[`${patternId}:${brand?.id ?? ""}`] ??
        defaultPaymentForPattern("hotel", patternId, pattern.label);
      merged.accommodationExpenses.push({
        id: expId,
        name: displayName,
        amount,
        platform: brand?.id,
        paymentMethod: hotelPm,
      });
      selections.push({
        patternId,
        brandId: brand?.id,
        brandName: brand?.name,
        amount,
        isKumamonEligible: brand?.isKumamonEligible ?? false,
        isRakutenJapanese: brand?.isRakutenJapanese ?? false,
        isDbsEcoExcluded: brand?.isDbsEcoExcluded ?? false,
        isKkday: brand?.isKkday ?? false,
        specialNote: brand?.specialNote,
        category: "hotel",
        expenseId: expId,
        expenseName: displayName,
        patternLabel: "訂購住宿",
        paymentMethod: hotelPm,
      });
      continue;
    }

    const cat = pattern.category;
    if (cat === "flight") merged.flight = (merged.flight ?? 0) + amount;
    else if (cat === "rental") merged.rental = (merged.rental ?? 0) + amount;
    else if (cat === "local") merged.local = (merged.local ?? 0) + amount;

    const brandId = selectedBrands?.[patternId];
    let brand: any = brandId ? pattern.brands?.find((b) => b.id === brandId) : undefined;
    if (!brand && brandId && pattern.subGroups) {
      for (const sg of pattern.subGroups) {
        const found = sg.brands.find((b) => b.id === brandId);
        if (found) {
          brand = found;
          break;
        }
      }
    }

    const bid = brand?.id;
    const isIc = bid ? IC_BRAND_IDS.has(bid) : false;
    const isApplePay =
      isIc && bid
        ? bid === "jp_ic_wallet_topup"
          ? applePayByBrand?.jp_ic_wallet_topup ?? applePayByBrand?.suica ?? true
          : applePayByBrand?.[bid] ?? true
        : undefined;

    const segPm =
      paymentOpts?.patternPaymentByKey?.[`${patternId}:${bid ?? ""}`] ??
      defaultPaymentForPattern(cat, patternId, pattern.label);

    selections.push({
      patternId,
      brandId: brand?.id,
      brandName: brand?.name,
      amount,
      isKumamonEligible: brand?.isKumamonEligible ?? false,
      isRakutenJapanese: brand?.isRakutenJapanese ?? false,
      isDbsEcoExcluded: brand?.isDbsEcoExcluded ?? false,
      isKkday: brand?.isKkday ?? false,
      specialNote: brand?.specialNote,
      category: pattern.category,
      patternLabel: pattern.label,
      isApplePay,
      paymentMethod: segPm,
    });
  }

  const hotelSelectionIds = new Set(
    selections.filter((s) => s.category === "hotel" && s.expenseId).map((s) => s.expenseId!)
  );
  for (const exp of merged.accommodationExpenses) {
    if (exp.amount <= 0.01) continue;
    if (hotelSelectionIds.has(exp.id)) continue;

    const baseHotelPm =
      paymentOpts?.accommodationPaymentById?.[exp.id] ?? exp.paymentMethod ?? "online";

    if (exp.platform) {
      const hotelBrand = HOTEL_BOOKING_BRANDS.find((b) => b.id === exp.platform);
      if (hotelBrand) {
        selections.push({
          patternId: "base-hotel-booking",
          brandId: hotelBrand.id,
          brandName: hotelBrand.name,
          amount: exp.amount,
          isKumamonEligible: hotelBrand.isKumamonEligible ?? false,
          isRakutenJapanese: hotelBrand.isRakutenJapanese ?? false,
          isDbsEcoExcluded: false,
          isKkday: hotelBrand.isKkday ?? false,
          specialNote: hotelBrand.specialNote,
          category: "hotel",
          expenseId: exp.id,
          expenseName: exp.name,
          patternLabel: "訂購住宿",
          paymentMethod: baseHotelPm,
        });
        continue;
      }
    }
    selections.push({
      patternId: "base-hotel-generic",
      amount: exp.amount,
      isKumamonEligible: false,
      isRakutenJapanese: false,
      isDbsEcoExcluded: false,
      isKkday: false,
      category: "hotel",
      expenseId: exp.id,
      expenseName: exp.name,
      patternLabel: "訂購住宿",
      paymentMethod: baseHotelPm,
    });
  }

  // Step 2: online flight booking brand selection.
  if ((merged.flight ?? 0) > 0 && baseFlightBrandId) {
    const flightBrand = FLIGHT_BOOKING_BRANDS.find((b) => b.id === baseFlightBrandId);
    if (flightBrand) {
      const flightPm = paymentOpts?.flightPaymentMethod ?? "online";
      selections.push({
        patternId: "base-flight-booking",
        brandId: flightBrand.id,
        brandName: flightBrand.name,
        amount: merged.flight,
        isKumamonEligible: flightBrand.isKumamonEligible ?? false,
        isRakutenJapanese: false,
        isDbsEcoExcluded: false,
        isKkday: flightBrand.isKkday ?? false,
        specialNote: flightBrand.specialNote,
        category: "flight",
        patternLabel: "訂購機票",
        paymentMethod: flightPm,
      });
    }
  }

  return { merged, selections };
}

// ─── Waterfall Step ────────────────────────────────────────────────────────
export interface WaterfallStep {
  stepIndex: number;
  category: SpendingCategory;
  categoryLabel: string;
  cardId: string;
  cardName: string;
  cardShortName: string;
  amount: number;
  cashbackRate: number;
  grossCashback: number;
  foreignFee: number;
  netCashback: number;
  isCapReached: boolean;
  capAmount?: number;
  enrolled: boolean;
  isKumamonBonus?: boolean;
  isDbsEcoBonus?: boolean;      // using DBS eco 4% bonus
  isDbsEcoBaseOnly?: boolean;   // DBS eco but excluded from bonus (SUICA etc)
  isOverflow?: boolean;         // using overflow rate (e.g. CTBC 3% after 11% cap)
  brandName?: string;
  specialNote?: string;
  holderIndex?: number;
  /** 與 holderIndex 對應，0 起算；結果頁「旅客 n」用 */
  travelerIndex?: number;
  needsHolderSwap?: boolean;
  baseCashback?: number;
  bonusCashback?: number;
  /** 住宿：自訂名稱（如：京都飯店） */
  expenseLabel?: string;
  /** 攻略主分類（對應 Step3 pattern 或訂購機票／訂購住宿） */
  subCategory?: string;
  /** 括號內：品牌或項目 */
  detailLabel?: string;
  /** 對應消費片段品牌（攻略標籤用） */
  brandId?: string;
  /** Step2／Step3 支付方式 */
  paymentMethod?: PaymentChannel;
  /** 同一筆消費被額度切分時的分組鍵（UI 合併顯示用） */
  splitGroupKey?: string;
  /** 分組類型（目前僅購物切分） */
  splitGroupType?: "shopping";
  /** 刷卡前須完成的手動操作（切換方案、領券、扣繳設定等） */
  actionNotes?: string[];
  /** 機票自動尋優 debug：一起刷路徑總淨回饋 */
  flightStrategyTogetherNet?: number;
  /** 機票自動尋優 debug：分開刷路徑總淨回饋 */
  flightStrategySplitNet?: number;
}

export interface CardBreakdown {
  cardId: string;
  cardName: string;
  cardShortName: string;
  categories: string[];
  spending: number;
  netCashback: number;
  capReached: boolean;
  capAmount?: number;              // pooled cap (points/NT$)
  capSpendingPerHolder?: number; // suggested per-holder spending cap for split
  enrolled: boolean;
  usedKumamonBonus: boolean;
  usedDbsEcoBonus: boolean;
  validityWarning?: string;
}

/** 分項淨回饋（與 waterfall 各步 netCashback 加總一致） */
export interface SavingsBreakdown {
  flightNet: number;
  hotelNet: number;
  domesticTransportNet: number;
  /** 日本當地、交通 IC、購物、租車等非國內交通之 local + rental */
  japanShoppingNet: number;
}

export interface CalculationResult {
  waterfallSteps: WaterfallStep[];
  totalSpending: number;
  totalGrossCashback: number;
  totalForeignFee: number;
  totalNetCashback: number;
  cardBreakdown: CardBreakdown[];
  hasKumamonBonus: boolean;
  hasDbsEcoBonus: boolean;
  savingsBreakdown: SavingsBreakdown;
}

function isDomesticTransportStep(step: WaterfallStep): boolean {
  const bid = step.brandId;
  if (
    bid === "taoyuan_airport_metro" ||
    bid === "taiwan_hsr_all" ||
    bid === "taiwan_rail_all"
  ) {
    return true;
  }
  const sub = step.subCategory ?? "";
  return /🚄\s*桃園|🚅\s*台灣高鐵|🚃\s*台灣鐵路/i.test(sub);
}

export function aggregateSavingsBreakdown(steps: WaterfallStep[]): SavingsBreakdown {
  const out: SavingsBreakdown = {
    flightNet: 0,
    hotelNet: 0,
    domesticTransportNet: 0,
    japanShoppingNet: 0,
  };
  for (const s of steps) {
    const n = s.netCashback;
    if (s.category === "flight") out.flightNet += n;
    else if (s.category === "hotel") out.hotelNet += n;
    else if (s.category === "rental") out.japanShoppingNet += n;
    else if (s.category === "local") {
      if (isDomesticTransportStep(s)) out.domesticTransportNet += n;
      else out.japanShoppingNet += n;
    }
  }
  return out;
}

const CATEGORY_LABELS: Record<SpendingCategory, string> = {
  flight: "訂購機票",
  hotel:  "住宿網站",
  rental: "租車費用",
  local:  "當地實體消費",
};

function resolveSegmentStepLabels(
  category: SpendingCategory,
  seg: PatternSelection
): { subCategory: string; detailLabel?: string } {
  if (category === "local") {
    if (seg.brandId === "taoyuan_airport_metro") {
      const raw = seg.brandName ? String(seg.brandName).replace(/^🚄\s*/u, "").trim() : "";
      return {
        subCategory: "🚄 桃園機場捷運",
        detailLabel: raw || undefined,
      };
    }
    if (seg.brandId === "taiwan_hsr_all") {
      const raw = seg.brandName ? String(seg.brandName).replace(/^🚅\s*/u, "").trim() : "";
      return {
        subCategory: "🚅 台灣高鐵",
        detailLabel: raw || undefined,
      };
    }
    if (seg.brandId === "taiwan_rail_all") {
      const raw = seg.brandName ? String(seg.brandName).replace(/^🚃\s*/u, "").trim() : "";
      return {
        subCategory: "🚃 台灣鐵路",
        detailLabel: raw || undefined,
      };
    }
    if (seg.patternId === "shopping" && seg.brandName) {
      const brand = String(seg.brandName).trim();
      if (brand) {
        return {
          subCategory: `🛍️ 購物消費 (${brand})`,
          detailLabel: undefined,
        };
      }
    }
  }
  let sub =
    seg.patternLabel ??
    (category === "flight"
      ? "訂購機票"
      : category === "hotel"
        ? "訂購住宿"
        : category === "rental"
          ? "租車費用"
          : "實體消費");
  if (category === "flight" && seg.travelerIndex != null) {
    sub = `訂購機票（旅客 ${seg.travelerIndex + 1}）`;
  }
  const rawDetail = seg.brandName ?? seg.expenseName;
  const detailLabel = rawDetail && String(rawDetail).trim() ? String(rawDetail).trim() : undefined;
  return { subCategory: sub, detailLabel };
}

/** 攻略用：依卡片與消費段產生「操作提醒」標籤文案 */
export function buildStepActionNotes(
  cardId: string,
  category: SpendingCategory,
  seg: Pick<PatternSelection, "brandId" | "patternId">
): string[] | undefined {
  const brandId = seg.brandId;
  if (cardId === "cathay-cube") {
    if (category === "local") {
      if (brandId === "taiwan_hsr_all") {
        return ["切換：趣旅行", "APP 領券"];
      }
      return ["切換：日本賞", "APP 領券"];
    }
    return undefined;
  }
  if (cardId === "taishin-flygo") {
    if (category === "flight" || brandId === "taiwan_hsr_all") {
      return ["切換：天天刷", "Richart 扣繳"];
    }
    return undefined;
  }
  if (cardId === "fubon-j" && category === "local" && brandId && IC_BRAND_IDS.has(brandId)) {
    return ["APP 領券"];
  }
  if (cardId === "union-jinghe" && category === "local") {
    if (
      brandId === "taoyuan_airport_metro" ||
      brandId === "taiwan_hsr_all" ||
      brandId === "taiwan_rail_all" ||
      (brandId && IC_BRAND_IDS.has(brandId))
    ) {
      return undefined;
    }
    return ["需感應支付 (QuicPay)"];
  }
  return undefined;
}

/** 機票總額依人數拆成整數元，餘數由前幾位旅客各 +1 */
function splitFlightTicketAmounts(total: number, partySize: number): number[] {
  const n = Math.max(1, Math.floor(partySize));
  if (total <= 0) return [];
  const base = Math.floor(total / n);
  const rem = Math.round(total - base * n);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + (i < rem ? 1 : 0));
  }
  return out;
}

/** 單張機票對應唯一 flight 片段（整張票一筆，禁止再拆成多個 segment） */
function buildFlightSegmentsForTicket(
  flightSelections: PatternSelection[],
  ticketAmount: number,
  travelerIndex: number,
  multiTraveler: boolean
): PatternSelection[] {
  if (ticketAmount <= 0) return [];
  if (flightSelections.length === 0) {
    return [
      {
        patternId: "flight-generic",
        amount: ticketAmount,
        isKumamonEligible: false,
        isRakutenJapanese: false,
        isDbsEcoExcluded: false,
        isKkday: false,
        category: "flight",
        patternLabel: "訂購機票",
        travelerIndex: multiTraveler ? travelerIndex : undefined,
      },
    ];
  }
  const head = flightSelections[0];
  const brandNames = flightSelections
    .map((s) => s.brandName)
    .filter((n): n is string => !!n && String(n).trim().length > 0);
  const brandName =
    brandNames.length > 0 ? Array.from(new Set(brandNames)).join("／") : head.brandName;
  return [
    {
      patternId: head.patternId,
      brandId: head.brandId,
      brandName,
      amount: ticketAmount,
      isKumamonEligible: flightSelections.some((s) => s.isKumamonEligible),
      isRakutenJapanese: false,
      isDbsEcoExcluded: false,
      isKkday: flightSelections.some((s) => s.isKkday),
      specialNote: head.specialNote,
      category: "flight",
      patternLabel: "訂購機票",
      paymentMethod: head.paymentMethod,
      travelerIndex: multiTraveler ? travelerIndex : undefined,
    },
  ];
}

// ─── Rounding helpers ──────────────────────────────────────────────────────
function applyRounding(value: number, mode: "round" | "floor" = "round"): number {
  return mode === "floor" ? Math.floor(value) : Math.round(value);
}

// ─── Card-specific rate calculation ────────────────────────────────────────

interface EffectiveRateResult {
  rate: number;
  baseRate?: number;
  bonusRate?: number;
  bonusCap?: number;
  cap?: number;
  overflowRate?: number;
  isKumamonBonus: boolean;
  isDbsEcoBonus: boolean;
  isDbsEcoBaseOnly: boolean;
  specialNote?: string;  // e.g. Kumamon Rakuten reminder
}

function getEffectiveRate(
  card: CreditCard,
  category: SpendingCategory,
  selections: PatternSelection[],
  isDbsEcoNewUser: boolean = false,
  rateOpts?: { isSinopacNewUser?: boolean; isUnionJingheNewUser?: boolean }
): EffectiveRateResult {
  const rule = card.cashback.find((r) => r.category === category);
  if (!rule) {
    return { rate: 0, isKumamonBonus: false, isDbsEcoBonus: false, isDbsEcoBaseOnly: false };
  }

  const categorySelections = selections.filter((s) => {
    const pattern = SPENDING_PATTERNS.find((p) => p.id === s.patternId);
    return pattern?.category === category;
  });

  const hasKkday = categorySelections.some((s) => s.isKkday);

  // ═══════════════════════════════════════════════════════════════════════════
  // 富邦 J 卡：Apple Pay 儲值 Suica/PASMO/ICOCA 單筆滿 NT$2,000 → 最高 10%
  // ═══════════════════════════════════════════════════════════════════════════
  if (card.id === "fubon-j" && category === "local") {
    const apIcTotal = categorySelections
      .filter((s) => IC_BRAND_IDS.has(s.brandId ?? "") && s.isApplePay !== false)
      .reduce((a, s) => a + s.amount, 0);
    if (apIcTotal >= 2000) {
      return {
        rate: 10.0,
        cap: 200,
        baseRate: 3.0,
        bonusRate: 7.0,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
        specialNote: "Apple Pay 儲值滿 NT$2,000：10%（加碼季上限 NT$200，約 NT$2,857）",
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 聯邦吉鶴：Apple Pay 加碼 +2.5%
  // ═══════════════════════════════════════════════════════════════════════════
  if (card.id === "union-jinghe" && category === "local") {
    const hasApplePayBoost = categorySelections.some((s) => s.isApplePay);
    if (hasApplePayBoost) {
      const nu = rateOpts?.isUnionJingheNewUser ? 0.3 : 0;
      return {
        rate: 5.0 + nu,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
        specialNote: rateOpts?.isUnionJingheNewUser
          ? "Apple Pay 加碼後約 5%+（新戶依登錄）"
          : "Apple Pay 加碼後約 5%（2.5%+2.5%，依登錄）",
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DBS eco永續卡 special logic
  // ═══════════════════════════════════════════════════════════════════════════
  if (card.id === "dbs-eco" && hasKkday) {
    // New user: 5% (1% base + 4% bonus, cap 600 pts)
    if (isDbsEcoNewUser) {
      return {
        rate: 5.0,
        baseRate: 1.0,
        bonusRate: 4.0,
        bonusCap: 600,
        isKumamonBonus: false,
        isDbsEcoBonus: true,
        isDbsEcoBaseOnly: false,
        specialNote: "KKday消費：星展新戶享5%（上限600點）",
      };
    }
    // Non-new user: 1% base only
    return {
      rate: rule.baseRate ?? 1.0,
      isKumamonBonus: false,
      isDbsEcoBonus: false,
      isDbsEcoBaseOnly: true,
      specialNote: "KKday消費：非新戶僅享1%基礎回饋",
    };
  }

  if (card.id === "dbs-eco" && category === "local") {
    /** Apple Pay 儲值 SUICA/PASMO/ICOCA 不計入 4% 加碼；未勾選 AP 之儲值仍可能適用加碼（依公告以試算保守處理） */
    const excludedFrom4Bonus = categorySelections.some(
      (s) => IC_BRAND_IDS.has(s.brandId ?? "") && s.isApplePay !== false
    );

    if (excludedFrom4Bonus) {
      // Only base 1%, no bonus
      return {
        rate: rule.baseRate ?? 1.0,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: true,
      };
    }
    
    // Full 5% (1% base + 4% bonus)
    return {
      rate: rule.rate,
      baseRate: rule.baseRate,
      bonusRate: rule.bonusRate,
      bonusCap: rule.bonusCap,
      isKumamonBonus: false,
      isDbsEcoBonus: true,
      isDbsEcoBaseOnly: false,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 玉山熊本熊卡 special logic (2026 權益文件)
  // - 住宿：樂天日文版 8.5%，其他僅 2.5%
  // - 指定通路：8.5%
  // - 計算採無條件捨去，需扣 1.5% 手續費
  // ═══════════════════════════════════════════════════════════════════════════
  if (card.id === "esun-kumamon") {
    // Hotel category: check for Rakuten Japanese ONLY
    if (category === "hotel") {
      const hasRakutenJP = categorySelections.some((s) => s.isRakutenJapanese);
      if (hasRakutenJP && card.kumamonHotelRakutenRate) {
        return {
          rate: card.kumamonHotelRakutenRate, // 8.5%
          cap: rule.cap,
          isKumamonBonus: true,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "樂天日文版享8.5%",
        };
      }
      // Non-Rakuten Japanese: use kumamonHotelOtherRate (2.5%)
      // Add reminder if user selected non-Japanese Rakuten
      const hasRakutenTW = categorySelections.some((s) => s.brandId === "rakuten_travel_tw");
      return {
        rate: card.kumamonHotelOtherRate ?? rule.rate, // 2.5%
        cap: rule.cap,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
        specialNote: hasRakutenTW ? "提醒：限日文網頁訂房方享8.5%，中文版僅2.5%" : undefined,
      };
    }

    // Other categories: check for Kumamon-eligible brands
    const hasEligibleBrand = categorySelections.some((s) => s.isKumamonEligible);
    if (hasEligibleBrand && card.kumamonBonusRate) {
      return {
        rate: card.kumamonBonusRate, // 8.5%
        cap: rule.cap,
        isKumamonBonus: true,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 國泰 CUBE（日本賞）special logic：指定通路需領券
  // ═══════════════════════════════════════════════════════════════════════════
  if (card.id === "cathay-cube") {
    const brandIds = new Set(categorySelections.map((s) => s.brandId ?? ""));
    const hasAny = (ids: string[]) => ids.some((id) => brandIds.has(id));
    const hasIcTopup = categorySelections.some((s) => IC_BRAND_IDS.has(s.brandId ?? ""));

    if (category === "local") {
      if (hasAny(["mitsui_outlet_park", "wamazing"])) {
        return {
          rate: 10.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：日本賞指定通路 10%（3.5%+券後 6.5%）",
        };
      }
      if (hasAny(["daimaru_matsuzakaya"])) {
        return {
          rate: 8.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：大丸指定通路 8%（3.5%+券後 4.5%）",
        };
      }
      if (hasIcTopup && categorySelections.some((s) => s.isApplePay !== false)) {
        return {
          rate: 5.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：Apple Pay 儲值交通卡 5%（3.5%+券後 1.5%）",
        };
      }
      if (hasAny(["bic_camera", "edion"])) {
        return {
          rate: 3.5,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：卡片回饋 3.5%，現場另有最高 7% 折扣",
        };
      }
      // Klook：日本指定商品 6%
      if (hasAny(["klook_hotel", "kkday_jr", "kkday_tokyo_park"])) {
        return {
          rate: 6.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：Klook 日本指定商品 6%",
        };
      }
      if (hasAny(["taiwan_hsr_all"])) {
        return {
          rate: 3.3,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "⚠️ 需切換至「趣旅行」方案並領券",
        };
      }
      const taoyuanCubeBoost = categorySelections.some(
        (s) =>
          s.brandId === "taoyuan_airport_metro" &&
          (s.paymentMethod === "physical" || s.paymentMethod === "apple_pay")
      );
      if (taoyuanCubeBoost) {
        return {
          rate: 5.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "⚠️ 需切換至「日本賞」方案，限感應過閘門使用",
        };
      }
      return {
        rate: 3.5,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
      };
    }

    if (category === "hotel") {
      if (hasAny(["hotels_com", "expedia"])) {
        return {
          rate: 10.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：Hotels.com / Expedia 最高 10%（5%+5%）",
        };
      }
      if (hasAny(["klook_hotel"])) {
        return {
          rate: 6.0,
          isKumamonBonus: false,
          isDbsEcoBonus: false,
          isDbsEcoBaseOnly: false,
          specialNote: "🎟️ 需領券：Klook 日本指定商品 6%",
        };
      }
      return {
        rate: 3.5,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 中信 UniOpen overflow logic
  // ═══════════════════════════════════════════════════════════════════════════
  // Handled during waterfall allocation, not here

  // 永豐幣倍：2%+4% 精選加碼；新戶另 +4% 合計試算 10% 與合併加碼上限（依登錄）
  if (card.id === "sinopac-doublebei") {
    const bonusCap = rule.bonusCap ?? rule.cap ?? 300;
    if (rateOpts?.isSinopacNewUser) {
      return {
        rate: 10,
        cap: bonusCap + SINOPAC_NEW_USER_PROMO_CAP_TWD,
        baseRate: 2,
        bonusRate: 8,
        overflowRate: rule.overflowRate,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
        specialNote: `新戶加碼試算：合計 10%（2%+4%精選+4%新戶，依登錄）；新戶加碼上限通常 NT$${SINOPAC_NEW_USER_PROMO_CAP_TWD.toLocaleString("zh-TW")}／期`,
      };
    }
    return {
      rate: 6,
      cap: bonusCap,
      baseRate: 2,
      bonusRate: 4,
      overflowRate: rule.overflowRate,
      isKumamonBonus: false,
      isDbsEcoBonus: false,
      isDbsEcoBaseOnly: false,
      specialNote: "精選通路 2%+4%（加碼月上限依 Level；4% 加碼刷滿約 NT$7,500／20,000）",
    };
  }

  // 台新 FlyGo：台灣高鐵購票 3.3%（玩旅刷／天天刷結構；引擎以 3.3%＋帳單上限試算）
  if (card.id === "taishin-flygo" && category === "local") {
    const brandIds = new Set(categorySelections.map((s) => s.brandId ?? ""));
    if (brandIds.has("taiwan_hsr_all")) {
      return {
        rate: 3.3,
        cap: rule.cap,
        isKumamonBonus: false,
        isDbsEcoBonus: false,
        isDbsEcoBaseOnly: false,
        specialNote: "⚠️ 需搭配 Richart 自動扣繳，並切換至「天天刷」方案",
      };
    }
  }

  // Default
  return {
    rate: rule.rate,
    cap: rule.cap,
    overflowRate: rule.overflowRate,
    isKumamonBonus: false,
    isDbsEcoBonus: false,
    isDbsEcoBaseOnly: false,
  };
}

// ─── Sorting for Waterfall priority ────────────────────────────────────────
// Priority: high-rate capped cards first, then high-rate uncapped cards

interface CardCandidate {
  card: CreditCard;
  rateResult: EffectiveRateResult;
  netRate: number;
  hasCap: boolean;
  priority: number; // higher = process first
}

function sortCardsForWaterfall(
  cards: CreditCard[],
  category: SpendingCategory,
  selections: PatternSelection[],
  isDbsEcoNewUser: boolean = false,
  rateOpts?: { isSinopacNewUser?: boolean; isUnionJingheNewUser?: boolean }
): CardCandidate[] {
  const candidates: CardCandidate[] = [];

  for (const card of cards) {
    const rateResult = getEffectiveRate(card, category, selections, isDbsEcoNewUser, rateOpts);
    if (rateResult.rate <= 0) continue;

    const feeRate = card.noForeignFee ? 0 : (card.foreignFee ?? FOREIGN_FEE);
    const netRate = rateResult.rate - feeRate;
    const hasCap = rateResult.cap !== undefined || rateResult.bonusCap !== undefined;

    // Priority scoring:
    // - Capped cards with high net rate come first (to consume their cap)
    // - Then uncapped cards by net rate
    const capBonus = hasCap ? 1000 : 0;
    const priority = capBonus + netRate * 100;

    candidates.push({ card, rateResult, netRate, hasCap, priority });
  }

  return candidates.sort((a, b) => b.priority - a.priority);
}

// ─── Waterfall allocation for one category ─────────────────────────────────

function waterfallForCategory(
  category: SpendingCategory,
  totalAmount: number,
  cards: CreditCard[],
  enrolledIds: Set<string>,
  stepIndexRef: { v: number },
  selections: PatternSelection[],
  holderCounts: Record<string, number> = {},
  isDbsEcoNewUser: boolean = false
): WaterfallStep[] {
  if (totalAmount <= 0) return [];

  const sorted = sortCardsForWaterfall(cards, category, selections, isDbsEcoNewUser);
  if (sorted.length === 0) return [];

  const steps: WaterfallStep[] = [];
  let remaining = totalAmount;

  // Find special notes from selections for this category
  const categorySelections = selections.filter((s) => {
    const pattern = SPENDING_PATTERNS.find((p) => p.id === s.patternId);
    return pattern?.category === category;
  });
  const specialNotes = categorySelections.filter((s) => s.specialNote).map((s) => s.specialNote);
  const brandNames = categorySelections.filter((s) => s.brandName).map((s) => s.brandName);

  for (let i = 0; i < sorted.length && remaining > 0.01; i++) {
    const { card, rateResult, netRate } = sorted[i];
    const enrolled = enrolledIds.has(card.id);
    const roundingMode = card.roundingMode ?? "round";
    const feeRate = card.noForeignFee ? 0 : (card.foreignFee ?? FOREIGN_FEE);

    // ═══════════════════════════════════════════════════════════════════════════
    // DBS eco with bonus cap (600 points for 4% bonus)
    // Capacity pooling: multiply cap by number of holders
    // ═══════════════════════════════════════════════════════════════════════════
    if (card.id === "dbs-eco" && rateResult.isDbsEcoBonus && rateResult.bonusCap) {
      const baseRate = rateResult.baseRate ?? 1.0;
      const bonusRate = rateResult.bonusRate ?? 4.0;
      const holders = holderCounts[card.id] ?? 1;
      const bonusCap = rateResult.bonusCap * holders; // 600 points x holders

      // Max spending for bonus cap: bonusCap / (bonusRate/100) = 600 / 0.04 = 15000 per holder
      const maxSpendingForBonusCap = (bonusCap / bonusRate) * 100;
      const bonusSlice = Math.min(remaining, maxSpendingForBonusCap);

      // Calculate cashback with full rate
      const grossRaw = (bonusSlice * rateResult.rate) / 100;
      const gross = applyRounding(grossRaw, roundingMode);
      const fee = applyRounding((bonusSlice * feeRate) / 100, roundingMode);
      const net = gross - fee;
      const isCapReached = bonusSlice >= maxSpendingForBonusCap - 0.01;

      steps.push({
        stepIndex: stepIndexRef.v++,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        cardId: card.id,
        cardName: card.name,
        cardShortName: card.shortName,
        amount: bonusSlice,
        cashbackRate: rateResult.rate,
        grossCashback: gross,
        foreignFee: fee,
        netCashback: net,
        isCapReached,
        capAmount: bonusCap,
        enrolled,
        isDbsEcoBonus: true,
        brandName: brandNames.length > 0 ? brandNames.join(", ") : undefined,
        specialNote: isCapReached ? `4%加碼上限${bonusCap}點已達標` : (specialNotes[0] ?? undefined),
      });

      remaining -= bonusSlice;

      // If cap reached and remaining, DBS eco falls to base 1% only
      if (remaining > 0.01) {
        const baseSlice = remaining;
        const baseGrossRaw = (baseSlice * baseRate) / 100;
        const baseGross = applyRounding(baseGrossRaw, roundingMode);
        const baseFee = applyRounding((baseSlice * feeRate) / 100, roundingMode);
        const baseNet = baseGross - baseFee;

        steps.push({
          stepIndex: stepIndexRef.v++,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          cardId: card.id,
          cardName: card.name,
          cardShortName: card.shortName,
          amount: baseSlice,
          cashbackRate: baseRate,
          grossCashback: baseGross,
          foreignFee: baseFee,
          netCashback: baseNet,
          isCapReached: false,
          enrolled,
          isDbsEcoBaseOnly: true,
          isOverflow: true,
          specialNote: "超出4%加碼上限，僅享1%基礎回饋",
        });
        remaining = 0;
      }
      continue;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Standard capped cards (with optional overflow rate)
    // Capacity pooling: multiply cap by number of holders
    // ═══════════════════════════════════════════════════════════════════════════
    if (rateResult.cap !== undefined) {
      const holders = holderCounts[card.id] ?? 1;
      const pooledCap = rateResult.cap * holders;
      const maxSpendingForCap = (pooledCap / rateResult.rate) * 100;
      const slice = Math.min(remaining, maxSpendingForCap);
      
      const grossRaw = (slice * rateResult.rate) / 100;
      const gross = applyRounding(grossRaw, roundingMode);
      const fee = applyRounding((slice * feeRate) / 100, roundingMode);
      const net = gross - fee;
      const isCapReached = slice >= maxSpendingForCap - 0.01;

      steps.push({
        stepIndex: stepIndexRef.v++,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        cardId: card.id,
        cardName: card.name,
        cardShortName: card.shortName,
        amount: slice,
        cashbackRate: rateResult.rate,
        grossCashback: gross,
        foreignFee: fee,
        netCashback: net,
        isCapReached,
        capAmount: pooledCap,
        enrolled,
        isKumamonBonus: rateResult.isKumamonBonus,
        isDbsEcoBonus: rateResult.isDbsEcoBonus,
        isDbsEcoBaseOnly: rateResult.isDbsEcoBaseOnly,
        brandName: brandNames.length > 0 ? brandNames.join(", ") : undefined,
        specialNote: holders > 1 && isCapReached 
          ? `${holders}人持有，需分開刷卡各享上限` 
          : (specialNotes.length > 0 ? specialNotes[0] : undefined),
      });

      remaining -= slice;

      // Handle overflow rate (e.g. CTBC 11% -> 3% after cap)
      if (remaining > 0.01 && rateResult.overflowRate) {
        const overflowSlice = remaining;
        const overflowGrossRaw = (overflowSlice * rateResult.overflowRate) / 100;
        const overflowGross = applyRounding(overflowGrossRaw, roundingMode);
        const overflowFee = applyRounding((overflowSlice * feeRate) / 100, roundingMode);
        const overflowNet = overflowGross - overflowFee;

        steps.push({
          stepIndex: stepIndexRef.v++,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          cardId: card.id,
          cardName: card.name,
          cardShortName: card.shortName,
          amount: overflowSlice,
          cashbackRate: rateResult.overflowRate,
          grossCashback: overflowGross,
          foreignFee: overflowFee,
          netCashback: overflowNet,
          isCapReached: false,
          enrolled,
          isOverflow: true,
          specialNote: `超出上限部分${rateResult.overflowRate}%`,
        });
        remaining = 0;
      }
      continue;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Uncapped cards — absorb all remaining
    // ═══════════════════════════════════════════════════════════════════════════
    const slice = remaining;
    const grossRaw = (slice * rateResult.rate) / 100;
    const gross = applyRounding(grossRaw, roundingMode);
    const fee = applyRounding((slice * feeRate) / 100, roundingMode);
    const net = gross - fee;

    steps.push({
      stepIndex: stepIndexRef.v++,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      cardId: card.id,
      cardName: card.name,
      cardShortName: card.shortName,
      amount: slice,
      cashbackRate: rateResult.rate,
      grossCashback: gross,
      foreignFee: fee,
      netCashback: net,
      isCapReached: false,
      enrolled,
      isKumamonBonus: rateResult.isKumamonBonus,
      isDbsEcoBonus: rateResult.isDbsEcoBonus,
      isDbsEcoBaseOnly: rateResult.isDbsEcoBaseOnly,
      brandName: brandNames.length > 0 ? brandNames.join(", ") : undefined,
      specialNote: specialNotes.length > 0 ? specialNotes[0] : undefined,
    });
    remaining = 0;
  }

  return steps;
}

// ─── V2: Segment-aware waterfall (DBS eco / E.SUN Kumamon 精確邏輯) ─────────────────────

type RoundingMode = "round" | "floor";

function getCardRoundingMode(card: CreditCard): RoundingMode {
  return (card.roundingMode ?? "round") as RoundingMode;
}

function maxSpendForPointsCap(capPointsRemaining: number, ratePercent: number, roundingMode: RoundingMode): number {
  if (capPointsRemaining <= 0 || ratePercent <= 0) return 0;
  const rate = ratePercent / 100;
  // Upper bound: slightly above the mathematical value to cover rounding jumps.
  let lo = 0;
  let hi = capPointsRemaining / rate;
  hi = hi * 1.2 + 10;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const points = applyRounding((mid * ratePercent) / 100, roundingMode);
    if (points <= capPointsRemaining) lo = mid;
    else hi = mid;
  }
  return lo;
}

function waterfallForCategorySegmentsV2(
  category: SpendingCategory,
  totalAmount: number,
  segments: PatternSelection[],
  cards: CreditCard[],
  enrolledIds: Set<string>,
  stepIndexRef: { v: number },
  holderCounts: Record<string, number>,
  isDbsEcoNewUser: boolean,
  kumamonWalletPaypayExcluded: boolean,
  kumamonFlightJpyEnabled: boolean,
  kumamonBonusCapState: { remainingPoints: number; initialPoints: number } | null,
  dbsEcoBonusCapState: { remainingPoints: number; initialPoints: number } | null,
  opts?: { indivisible?: boolean; flightTravelerIndex?: number; splitTravelerSlot?: number; partySize?: number },
  rateOpts?: { isSinopacNewUser?: boolean; isUnionJingheNewUser?: boolean }
): WaterfallStep[] {
  const effectivePartySize = Math.max(1, opts?.partySize ?? 1);
  if (totalAmount <= 0) return [];
  if (!cards.length) return [];

  const steps: WaterfallStep[] = [];

  const safeSegments = segments
    .filter((s) => s.amount > 0.01)
    .map((s) => ({
      ...s,
      category: s.category ?? category,
    }));

  const segTotal = safeSegments.reduce((sum, s) => sum + s.amount, 0);
  if (segTotal < totalAmount - 0.01) {
    const head = safeSegments[0];
    safeSegments.push({
      patternId: "remainder",
      amount: totalAmount - segTotal,
      isKumamonEligible: head?.isKumamonEligible ?? false,
      isRakutenJapanese: head?.isRakutenJapanese ?? false,
      isDbsEcoExcluded: head?.isDbsEcoExcluded ?? false,
      isKkday: head?.isKkday ?? false,
      category,
      expenseId: head?.expenseId,
      expenseName: head?.expenseName,
      brandName: head?.brandName,
      brandId: head?.brandId,
      paymentMethod: head?.paymentMethod,
      patternLabel:
        head?.patternLabel ??
        (category === "flight"
          ? "訂購機票"
          : category === "hotel"
            ? "訂購住宿"
            : category === "rental"
              ? "租車費用"
              : "實體消費"),
    });
  }

  // Standard capped cards: cap applies to gross cashback points for this category.
  const standardCapStateByCardId = new Map<
    string,
    {
      remainingPoints: number;
      initialPoints: number;
      ratePercent: number;
      roundingMode: RoundingMode;
      feeRate: number;
      overflowRate?: number;
      holderRemainingPoints: number[];
    }
  >();

  for (const card of cards) {
    if (card.id === "dbs-eco" || card.id === "esun-kumamon" || card.id === "sinopac-doublebei") continue;
    const rule = card.cashback.find((r) => r.category === category);
    if (!rule || rule.cap === undefined) continue;
    const rawHolders = holderCounts[card.id];
    if (rawHolders !== undefined && rawHolders <= 0) continue; // 未持有：禁止進入上限分配
    const holders = rawHolders ?? 1;
    const capInitialPoints = rule.cap * holders;
    const roundingMode = getCardRoundingMode(card);
    const feeRate = card.noForeignFee ? 0 : (card.foreignFee ?? FOREIGN_FEE);
    standardCapStateByCardId.set(card.id, {
      remainingPoints: capInitialPoints,
      initialPoints: capInitialPoints,
      ratePercent: rule.rate,
      roundingMode,
      feeRate,
      overflowRate: rule.overflowRate,
      holderRemainingPoints: Array.from({ length: holders }, () => rule.cap ?? 0),
    });
  }

  // 永豐幣倍：2%+4% 精選加碼（月上限依 Level）；新戶路徑改於候選中以 10% 合併試算
  const sinopacCardForCap = cards.find((c) => c.id === "sinopac-doublebei");
  const sinopacRuleForCap = sinopacCardForCap?.cashback.find((r) => r.category === category);
  let sinopacBonusRemaining = 0;
  let sinopacBonusInitial = 0;
  let sinopacNewUserRemaining = 0;
  if (sinopacRuleForCap?.bonusCap != null) {
    const sh = Math.max(1, holderCounts["sinopac-doublebei"] ?? 1);
    sinopacBonusInitial = sinopacRuleForCap.bonusCap * sh;
    sinopacBonusRemaining = sinopacBonusInitial;
    if (rateOpts?.isSinopacNewUser) {
      sinopacNewUserRemaining = (sinopacRuleForCap.bonusCap + SINOPAC_NEW_USER_PROMO_CAP_TWD) * sh;
    }
  }

  // DBS eco: 4% bonus cap applies only to the 4% bonus portion (600 points/period per holder).
  let dbsEcoBonusCapRemainingPoints = dbsEcoBonusCapState?.remainingPoints ?? 0;
  let dbsEcoBonusCapInitialPoints = dbsEcoBonusCapState?.initialPoints ?? 0;
  let dbsEcoBaseRate = 1;
  let dbsEcoBonusRate = 4;
  let dbsEcoRoundingMode: RoundingMode = "round";
  let dbsEcoFeeRate = FOREIGN_FEE;

  const dbsEcoCard = cards.find((c) => c.id === "dbs-eco");
  if (dbsEcoCard) {
    const localRule = dbsEcoCard.cashback.find((r) => r.category === "local");
    dbsEcoBaseRate = localRule?.baseRate ?? 1;
    dbsEcoBonusRate = localRule?.bonusRate ?? 4;
    dbsEcoRoundingMode = getCardRoundingMode(dbsEcoCard);
    dbsEcoFeeRate = dbsEcoCard.noForeignFee ? 0 : (dbsEcoCard.foreignFee ?? FOREIGN_FEE);
  }

  // Allocate each segment with current cap states.
  for (const [segIdx, seg] of safeSegments.entries()) {
    let remainingSeg = seg.amount;
    const shoppingBlob = `${seg.patternLabel ?? ""}${seg.brandName ?? ""}${seg.expenseName ?? ""}`;
    const isShoppingSplitCandidate =
      category === "local" && /(購物|百貨|藥妝|電器|outlet|mall|store|bic|三越|伊勢丹)/i.test(shoppingBlob);
    const isAtomicShopping = isShoppingSplitCandidate;
    const splitGroupKey = isShoppingSplitCandidate
      ? `shopping:${segIdx}:${seg.brandId ?? seg.brandName ?? seg.patternId}`
      : undefined;
    /** 同一消費片段內，每張卡最後一次刷卡對應的持卡人索引（溢出／降階步驟繼承用） */
    const lastHolderByCardId = new Map<string, number>();
    const splitSlot = opts?.splitTravelerSlot;
    const pushSegmentFallback = (amount: number): boolean => {
      const fallbackCard = cards.find((c) => {
        const rawHeld = holderCounts[c.id];
        const held = rawHeld ?? 1;
        if (rawHeld !== undefined && rawHeld <= 0) return false;
        if (splitSlot === undefined) return true;
        return splitSlot < held;
      });
      if (!fallbackCard || amount <= 0.01) return false;
      const rule = fallbackCard.cashback.find((r) => r.category === category);
      if (!rule) return false;
      const roundingMode = getCardRoundingMode(fallbackCard);
      const feeRate = fallbackCard.noForeignFee ? 0 : (fallbackCard.foreignFee ?? FOREIGN_FEE);
      const gross = applyRounding((amount * rule.rate) / 100, roundingMode);
      const fee = applyRounding((amount * feeRate) / 100, roundingMode);
      const net = gross - fee;
      const labels = resolveSegmentStepLabels(category, seg);
      const fallbackHolder =
        splitSlot !== undefined ? splitSlot : (lastHolderByCardId.get(fallbackCard.id) ?? 0);
      steps.push({
        stepIndex: stepIndexRef.v++,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        cardId: fallbackCard.id,
        cardName: fallbackCard.name,
        cardShortName: fallbackCard.shortName,
        amount,
        cashbackRate: rule.rate,
        grossCashback: gross,
        foreignFee: fee,
        netCashback: net,
        isCapReached: false,
        enrolled: enrolledIds.has(fallbackCard.id),
        brandName: seg.brandName,
        brandId: seg.brandId,
        paymentMethod: seg.paymentMethod,
        specialNote: seg.specialNote,
        expenseLabel: seg.expenseName,
        subCategory: labels.subCategory,
        detailLabel: labels.detailLabel,
        holderIndex: fallbackHolder,
        travelerIndex: fallbackHolder,
        actionNotes: buildStepActionNotes(fallbackCard.id, category, seg),
      });
      lastHolderByCardId.set(fallbackCard.id, fallbackHolder);
      return true;
    };
    while (remainingSeg > 0.01) {
      type Candidate = {
        card: CreditCard;
        phase:
          | "dbs-bonus"
          | "dbs-base"
          | "dbs-online-bonus"
          | "dbs-online-base"
          | "kumamon-bonus"
          | "kumamon-base"
          | "sinopac-bonus"
          | "sinopac-base"
          | "sinopac-newuser"
          | "fubon-ap-ic"
          | "union-ap"
          | "standard-cap"
          | "standard-uncapped"
          | "standard-overflow"
          | "ic-priority";
        effectiveRatePercent: number; // for display
        maxSpend: number;
        priority: number;
        roundingMode: RoundingMode;
        feeRate: number;
        capInitialPoints?: number;
        capUsesPoints?: boolean;
        capDepletedNote?: string;
        capReachedNote?: string;
        segmentSpecialNote?: string;
        // For DBS/Kumamon:
        baseRatePercent?: number;
        bonusRatePercent?: number;
        holderIndex?: number;
      };

      const candidates: Candidate[] = [];
      const isApIcTopup =
        category === "local" && IC_BRAND_IDS.has(seg.brandId ?? "") && seg.isApplePay !== false;

      for (const card of cards) {
        const rawHeld = holderCounts[card.id];
        const holderTotal = rawHeld ?? 1;
        if (rawHeld !== undefined && rawHeld <= 0) continue; // 未持有：禁止產生任何該卡步驟
        if (splitSlot !== undefined && splitSlot >= holderTotal) continue; // 分開買：落在該旅客槽位的持卡人數需足夠
        const enrolled = enrolledIds.has(card.id);
        const roundingMode = getCardRoundingMode(card);
        const isDomesticTransport =
          category === "local" && DOMESTIC_TRANSPORT_BRAND_IDS.has(seg.brandId ?? "");
        const feeRate = isDomesticTransport ? 0 : (card.noForeignFee ? 0 : (card.foreignFee ?? FOREIGN_FEE));

        // ── 國內交通專屬：桃園機捷以 CUBE 5% 為首選；台灣高鐵 CUBE／FlyGo 並列 3.3%；其餘 1% ──
        if (isDomesticTransport) {
          const isTaoyuanMetro = seg.brandId === "taoyuan_airport_metro";
          const isTaiwanHsr = seg.brandId === "taiwan_hsr_all";
          const enrolledBoost = enrolled ? 50 : 0;
          /** 機捷：僅 CUBE + 感應（實體／Apple Pay）5%；高鐵：CUBE／FlyGo 3.3% */
          const isCubeTaoyuan =
            card.id === "cathay-cube" &&
            isTaoyuanMetro &&
            (seg.paymentMethod === "physical" || seg.paymentMethod === "apple_pay");
          const isCubeHsr = card.id === "cathay-cube" && isTaiwanHsr;
          if (isCubeTaoyuan) {
            candidates.push({
              card,
              phase: "standard-uncapped",
              effectiveRatePercent: 5.0,
              maxSpend: remainingSeg,
              priority: 100000 + enrolledBoost,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: "⚠️ 需切換至「日本賞」方案，限感應過閘門使用",
            });
          } else if (isCubeHsr) {
            candidates.push({
              card,
              phase: "standard-uncapped",
              effectiveRatePercent: 3.3,
              maxSpend: remainingSeg,
              priority: 100000 + enrolledBoost,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: "⚠️ 需切換至「趣旅行」方案並領券",
            });
          } else if (card.id === "taishin-flygo" && isTaiwanHsr) {
            candidates.push({
              card,
              phase: "standard-uncapped",
              effectiveRatePercent: 3.3,
              maxSpend: remainingSeg,
              priority: 100000 + enrolledBoost,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: "⚠️ 需搭配 Richart 自動扣繳，並切換至「天天刷」方案",
            });
          } else {
            candidates.push({
              card,
              phase: "standard-uncapped",
              effectiveRatePercent: 1.0,
              maxSpend: remainingSeg,
              priority: 1000,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: "國內交通以一般國內消費 1% 試算（不套用日本旅遊加碼）",
            });
          }
          continue;
        }

        // ── 日本交通卡儲值（Apple Pay）專屬優先序 ──
        if (isApIcTopup) {
          const byId = (id: string) => cards.find((c) => c.id === id);
          const pushCandidate = (target: CreditCard | undefined, rate: number, priority: number, maxSpend = remainingSeg, note?: string) => {
            if (!target || target.id !== card.id || maxSpend <= 0.01) return;
            candidates.push({
              card: target,
              phase: "ic-priority",
              effectiveRatePercent: rate,
              maxSpend: Math.min(remainingSeg, maxSpend),
              priority,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: note,
            });
          };

          // 1) 富邦 J：10%，加碼上限 NT$200（約刷 NT$2,857）
          const fubon = byId("fubon-j");
          const fubonKey = "__fubon_ap_ic_spend_cap__";
          const fubonHolderKey = "__fubon_ap_ic_spend_cap_by_holder__";
          const wfState = waterfallForCategorySegmentsV2 as unknown as Record<string, unknown>;
          const fubonHolders = Math.max(1, holderCounts["fubon-j"] ?? 1);
          const slot = opts?.splitTravelerSlot ?? 0;
          const fubonByHolder = (wfState[fubonHolderKey] as number[] | undefined) ??
            Array.from({ length: fubonHolders }, () => 2857);
          wfState[fubonHolderKey] = fubonByHolder;
          const fubonCapRemain =
            opts?.splitTravelerSlot !== undefined
              ? (fubonByHolder[slot] ?? 0)
              : ((wfState[fubonKey] as number | undefined) ?? (fubonHolders * 2857));
          pushCandidate(
            fubon,
            10.0,
            100000,
            fubonCapRemain,
            "交通卡 Apple Pay 儲值首選 10%（加碼上限約 NT$2,857）"
          );

          // 2) 熊本熊：8.5%，受 6% 加碼上限約 NT$8,333/人
          const kumamon = byId("esun-kumamon");
          if (kumamon && card.id === "esun-kumamon") {
            const kmHolderKey = "__kumamon_ic_bonus_spend_cap_by_holder__";
            const kmHolders = Math.max(1, holderCounts["esun-kumamon"] ?? 1);
            const slot = opts?.splitTravelerSlot ?? 0;
            const kmByHolder = (wfState[kmHolderKey] as number[] | undefined) ??
              Array.from({ length: kmHolders }, () => 500 / 0.06);
            wfState[kmHolderKey] = kmByHolder;
            const kmHolderRemain =
              opts?.splitTravelerSlot !== undefined
                ? (kmByHolder[slot] ?? 0)
                : (kumamonBonusCapState && kumamonBonusCapState.remainingPoints > 0.01
                    ? maxSpendForPointsCap(kumamonBonusCapState.remainingPoints, 6.0, roundingMode)
                    : 0);
            const kmMax = Math.max(0, kmHolderRemain);
            if (kmMax > 0.01) {
              pushCandidate(
                kumamon,
                8.5,
                90000,
                kmMax,
                "交通卡 Apple Pay 儲值次選 8.5%（受加碼上限）"
              );
            }
          }

          // 3) 國泰 CUBE（日本賞）：5%（需領券）
          pushCandidate(
            byId("cathay-cube"),
            5.0,
            80000,
            remainingSeg,
            "🎟️ 需領券：日本賞 Apple Pay 儲值交通卡 5%"
          );
          // 4) 台新 FlyGo：3.3%
          pushCandidate(byId("taishin-flygo"), 3.3, 70000, remainingSeg, "交通卡 Apple Pay 儲值 3.3%");
          // 5) 聯邦吉鶴：2.5%
          pushCandidate(byId("union-jinghe"), 2.5, 60000, remainingSeg, "交通卡儲值以一般海外 2.5% 試算（不套用交通感應活動）");
          // 6) 星展 eco：1%
          pushCandidate(byId("dbs-eco"), 1.0, 50000, remainingSeg, "Apple Pay 儲值交通卡排除 4% 加碼，僅 1%");
          continue;
        }

        // ── DBS eco local special ──
        if (card.id === "dbs-eco" && category === "local") {
          const isBonusEligible = !seg.isDbsEcoExcluded && !seg.isKkday;
          if (isBonusEligible && dbsEcoBonusCapRemainingPoints > 0.01) {
            const holderCount = Math.max(1, holderCounts["dbs-eco"] ?? 1);
            const holderCap = dbsEcoBonusCapInitialPoints / holderCount;
            const currentHolder = holderCount > 1
              ? Math.min(holderCount - 1, Math.floor((dbsEcoBonusCapInitialPoints - dbsEcoBonusCapRemainingPoints) / Math.max(holderCap, 1)))
              : 0;
            const maxSpend = Math.min(
              remainingSeg,
              maxSpendForPointsCap(dbsEcoBonusCapRemainingPoints, dbsEcoBonusRate, dbsEcoRoundingMode)
            );
            if (maxSpend > 0.01) {
              const effectiveRatePercent = dbsEcoBaseRate + dbsEcoBonusRate; // 5%
              const netRate = effectiveRatePercent - feeRate;
              candidates.push({
                card,
                phase: "dbs-bonus",
                effectiveRatePercent,
                maxSpend,
                priority: 1000 + netRate * 100,
                roundingMode,
                feeRate,
                capInitialPoints: dbsEcoBonusCapInitialPoints,
                capUsesPoints: true,
                capDepletedNote: "超出4%加碼上限，僅享1%基礎回饋",
                capReachedNote: `4%加碼上限${dbsEcoBonusCapInitialPoints}點已達標`,
                segmentSpecialNote: seg.specialNote,
                baseRatePercent: dbsEcoBaseRate,
                bonusRatePercent: dbsEcoBonusRate,
                holderIndex: currentHolder,
              });
            }
          } else {
            // base only (excluded brand or bonus cap depleted)
            const baseOnlyRatePercent = dbsEcoBaseRate;
            const netRate = baseOnlyRatePercent - feeRate;
            const holderCountBase = Math.max(1, holderCounts["dbs-eco"] ?? 1);
            const holderCapBase = dbsEcoBonusCapInitialPoints / holderCountBase;
            const currentHolderBase =
              holderCountBase > 1
                ? Math.min(
                    holderCountBase - 1,
                    Math.floor(
                      (dbsEcoBonusCapInitialPoints - dbsEcoBonusCapRemainingPoints) / Math.max(holderCapBase, 1)
                    )
                  )
                : 0;

            if (netRate >= 0 || remainingSeg > 0) {
              const isExcluded = !!seg.isDbsEcoExcluded;
              const bonusCapDepleted = isBonusEligible && dbsEcoBonusCapRemainingPoints <= 0.01;
              const specialNote = isExcluded
                ? "⚠️ 排除加碼：本筆僅享 1% 基礎回饋"
                : bonusCapDepleted
                ? "超出4%加碼上限，僅享1%基礎回饋"
                : seg.specialNote;
              candidates.push({
                card,
                phase: "dbs-base",
                effectiveRatePercent: baseOnlyRatePercent,
                maxSpend: remainingSeg,
                priority: netRate * 100,
                roundingMode,
                feeRate,
                capUsesPoints: false,
                segmentSpecialNote: specialNote,
                baseRatePercent: dbsEcoBaseRate,
                holderIndex: currentHolderBase,
              });
            }
          }
          continue;
        }

        // ── DBS eco online platform special (KKday/Trip.com etc.) ──
        if (card.id === "dbs-eco" && category !== "local") {
          const baseRatePercent = 1.0;
          const bonusRatePercent = 4.0;
          if (isDbsEcoNewUser && dbsEcoBonusCapRemainingPoints > 0.01) {
            const maxSpend = Math.min(
              remainingSeg,
              maxSpendForPointsCap(dbsEcoBonusCapRemainingPoints, bonusRatePercent, roundingMode)
            );
            if (maxSpend > 0.01) {
              const holderCount = Math.max(1, holderCounts["dbs-eco"] ?? 1);
              const holderCap = dbsEcoBonusCapInitialPoints / holderCount;
              const currentHolder = holderCount > 1
                ? Math.min(holderCount - 1, Math.floor((dbsEcoBonusCapInitialPoints - dbsEcoBonusCapRemainingPoints) / Math.max(holderCap, 1)))
                : 0;
              const effectiveRatePercent = baseRatePercent + bonusRatePercent;
              const netRate = effectiveRatePercent - feeRate;
              candidates.push({
                card,
                phase: "dbs-online-bonus",
                effectiveRatePercent,
                maxSpend,
                priority: 1000 + netRate * 100,
                roundingMode,
                feeRate,
                capInitialPoints: dbsEcoBonusCapInitialPoints,
                capUsesPoints: true,
                segmentSpecialNote: "旅遊平台消費：星展新戶 5%（上限 600 點）",
                baseRatePercent,
                bonusRatePercent,
                capReachedNote: `加碼上限 600 點（約 NT$15,000）已達標`,
                holderIndex: currentHolder,
              });
            }
          } else {
            const holderCountOb = Math.max(1, holderCounts["dbs-eco"] ?? 1);
            const holderCapOb = dbsEcoBonusCapInitialPoints / holderCountOb;
            const currentHolderOb =
              holderCountOb > 1
                ? Math.min(
                    holderCountOb - 1,
                    Math.floor(
                      (dbsEcoBonusCapInitialPoints - dbsEcoBonusCapRemainingPoints) / Math.max(holderCapOb, 1)
                    )
                  )
                : 0;
            candidates.push({
              card,
              phase: "dbs-online-base",
              effectiveRatePercent: baseRatePercent,
              maxSpend: remainingSeg,
              priority: (baseRatePercent - feeRate) * 100,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: isDbsEcoNewUser
                ? "超出4%加碼上限，僅享1%基礎回饋"
                : "旅遊平台消費：非新戶僅享1%基礎回饋",
              baseRatePercent,
              holderIndex: currentHolderOb,
            });
          }
          continue;
        }

        // ── E.SUN Kumamon special ──
        if (card.id === "esun-kumamon" && (category === "hotel" || category === "local" || category === "flight")) {
          const baseRatePercent = 2.5;
          const bonusRatePercent = 6.0;

          const bonusEligibleByMerchants =
            category === "hotel"
              ? !!seg.isRakutenJapanese
              : category === "flight"
                ? (!!seg.isKumamonEligible && kumamonFlightJpyEnabled)
                : !!seg.isKumamonEligible;

          const bonusEligible = bonusEligibleByMerchants && !kumamonWalletPaypayExcluded;

          if (bonusEligible && kumamonBonusCapState && kumamonBonusCapState.remainingPoints > 0.01) {
            const maxSpend = Math.min(
              remainingSeg,
              maxSpendForPointsCap(kumamonBonusCapState.remainingPoints, bonusRatePercent, roundingMode)
            );
            if (maxSpend > 0.01) {
              const holderCount = Math.max(1, holderCounts["esun-kumamon"] ?? 1);
              const holderCap = kumamonBonusCapState.initialPoints / holderCount;
              const currentHolder = holderCount > 1
                ? Math.min(holderCount - 1, Math.floor((kumamonBonusCapState.initialPoints - kumamonBonusCapState.remainingPoints) / Math.max(holderCap, 1)))
                : 0;
              const effectiveRatePercent = baseRatePercent + bonusRatePercent; // 8.5%
              const netRate = effectiveRatePercent - feeRate;
              candidates.push({
                card,
                phase: "kumamon-bonus",
                effectiveRatePercent,
                maxSpend,
                priority: 1000 + netRate * 100,
                roundingMode,
                feeRate,
                capInitialPoints: kumamonBonusCapState.initialPoints,
                capUsesPoints: true,
                segmentSpecialNote: seg.specialNote,
                baseRatePercent,
                bonusRatePercent,
                capReachedNote: `6%加碼上限NT$${kumamonBonusCapState.initialPoints}已達標`,
                capDepletedNote: "超出6%加碼上限，僅享2.5%基礎回饋",
                holderIndex: currentHolder,
              });
            }
          } else {
            // base only (non-eligible, wallet/paypay excluded, or cap depleted)
            const netRate = baseRatePercent - feeRate;
            const bonusCapDepleted = bonusEligibleByMerchants && !kumamonWalletPaypayExcluded && (!kumamonBonusCapState || kumamonBonusCapState.remainingPoints <= 0.01);
            const walletExcluded = bonusEligibleByMerchants && kumamonWalletPaypayExcluded;
            const notJpyForFlight = category === "flight" && !!seg.isKumamonEligible && !kumamonFlightJpyEnabled;
            const specialNote = walletExcluded
              ? "已排除玉山 Wallet/PayPay：僅享2.5%基礎回饋"
              : notJpyForFlight
                ? "JAL/ANA 未以日圓結帳：僅享2.5%基礎回饋"
              : bonusCapDepleted
                ? "超出6%加碼上限，僅享2.5%基礎回饋"
                : seg.specialNote;
            const holderCountKm = Math.max(1, holderCounts["esun-kumamon"] ?? 1);
            const holderCapKm = kumamonBonusCapState
              ? kumamonBonusCapState.initialPoints / holderCountKm
              : 0;
            const currentHolderKm =
              holderCountKm > 1 && kumamonBonusCapState
                ? Math.min(
                    holderCountKm - 1,
                    Math.floor(
                      (kumamonBonusCapState.initialPoints - kumamonBonusCapState.remainingPoints) /
                        Math.max(holderCapKm, 1)
                    )
                  )
                : 0;
            candidates.push({
              card,
              phase: "kumamon-base",
              effectiveRatePercent: baseRatePercent,
              maxSpend: remainingSeg,
              priority: netRate * 100,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: specialNote,
              baseRatePercent,
              holderIndex: currentHolderKm,
            });
          }
          continue;
        }

        // ── 富邦 J：Apple Pay 儲值 IC 單筆滿 NT$2,000 → 試算 10%（加碼季上限 NT$200，此處以單段上限近似）
        if (card.id === "fubon-j" && category === "local") {
          const isApIc =
            IC_BRAND_IDS.has(seg.brandId ?? "") && seg.isApplePay !== false;
          if (isApIc && remainingSeg >= 2000) {
            const r = 10;
            const netR = r - feeRate;
            candidates.push({
              card,
              phase: "fubon-ap-ic",
              effectiveRatePercent: r,
              maxSpend: remainingSeg,
              priority: 1000 + netR * 100,
              roundingMode,
              feeRate,
              capUsesPoints: false,
              segmentSpecialNote: "Apple Pay 儲值 IC 滿 NT$2,000：最高 10%（加碼季上限 NT$200）",
            });
            continue;
          }
        }

        // ── 聯邦吉鶴：Apple Pay 加碼後試算 5%
        if (card.id === "union-jinghe" && category === "local" && seg.isApplePay === true) {
          const r = 5.0 + (rateOpts?.isUnionJingheNewUser ? 0.3 : 0);
          const netR = r - feeRate;
          candidates.push({
            card,
            phase: "union-ap",
            effectiveRatePercent: r,
            maxSpend: remainingSeg,
            priority: 1000 + netR * 100,
            roundingMode,
            feeRate,
            capUsesPoints: false,
            segmentSpecialNote: rateOpts?.isUnionJingheNewUser
              ? "Apple Pay 加碼（新戶依登錄）"
              : "Apple Pay 加碼（2.5%+2.5%，依登錄）",
          });
          continue;
        }

        // ── 永豐幣倍：2%+4% 精選加碼（月上限依 Level）；新戶合併試算 10% 與加碼上限 ──
        if (card.id === "sinopac-doublebei") {
          const rule = card.cashback.find((r) => r.category === category);
          if (!rule) continue;
          const baseR = rule.baseRate ?? 2;
          const bonusR = rule.bonusRate ?? 4;
          const rounding = roundingMode;

          if (rateOpts?.isSinopacNewUser) {
            if (sinopacNewUserRemaining > 0.01) {
              const maxSpend = Math.min(
                remainingSeg,
                maxSpendForPointsCap(sinopacNewUserRemaining, 10, rounding)
              );
              if (maxSpend > 0.01) {
                const netR = 10 - feeRate;
                candidates.push({
                  card,
                  phase: "sinopac-newuser",
                  effectiveRatePercent: 10,
                  maxSpend,
                  priority: 1000 + netR * 100,
                  roundingMode: rounding,
                  feeRate,
                  capUsesPoints: true,
                  capInitialPoints: (rule.bonusCap ?? 300) + SINOPAC_NEW_USER_PROMO_CAP_TWD,
                  segmentSpecialNote:
                    `新戶加碼試算：合計 10%（依登錄）；加碼合併上限含新戶 NT$${SINOPAC_NEW_USER_PROMO_CAP_TWD.toLocaleString("zh-TW")}／期`,
                });
              }
            } else {
              const netR = baseR - feeRate;
              candidates.push({
                card,
                phase: "sinopac-base",
                effectiveRatePercent: baseR,
                maxSpend: remainingSeg,
                priority: netR * 100,
                roundingMode: rounding,
                feeRate,
                capUsesPoints: false,
                baseRatePercent: baseR,
                segmentSpecialNote: "加碼額度已盡，僅享 2% 基本回饋（依登錄）",
              });
            }
          } else if (sinopacBonusRemaining > 0.01) {
            const maxSpend = Math.min(
              remainingSeg,
              maxSpendForPointsCap(sinopacBonusRemaining, bonusR, rounding)
            );
            if (maxSpend > 0.01) {
              const effectiveRatePercent = baseR + bonusR;
              const netR = effectiveRatePercent - feeRate;
              candidates.push({
                card,
                phase: "sinopac-bonus",
                effectiveRatePercent,
                maxSpend,
                priority: 1000 + netR * 100,
                roundingMode: rounding,
                feeRate,
                capUsesPoints: true,
                baseRatePercent: baseR,
                bonusRatePercent: bonusR,
                capInitialPoints: sinopacBonusInitial,
                segmentSpecialNote: rule.ruleNote,
              });
            }
          } else {
            const netR = baseR - feeRate;
            candidates.push({
              card,
              phase: "sinopac-base",
              effectiveRatePercent: baseR,
              maxSpend: remainingSeg,
              priority: netR * 100,
              roundingMode: rounding,
              feeRate,
              capUsesPoints: false,
              baseRatePercent: baseR,
              segmentSpecialNote: "精選加碼已達上限，僅享 2% 基本回饋（依登錄）",
            });
          }
          continue;
        }

        // ── Standard cards (cap/overflow/uncapped) ──
        const rule = card.cashback.find((r) => r.category === category);
        if (!rule) continue;
        const rounding = roundingMode;

        /** 中信 UniOpen：國外實體 11% vs 線上／第三方 3%（與 Step 支付方式連動） */
        const flightLikeRule = card.cashback.find((r) => r.category === "flight");
        const useCtbcOnlineLocal =
          card.id === "ctbc-uniopen" &&
          category === "local" &&
          seg.paymentMethod === "online";
        let effectiveStandardRate = rule.rate;
        let effectiveOverflowRate = rule.overflowRate;
        if (useCtbcOnlineLocal && flightLikeRule) {
          effectiveStandardRate = flightLikeRule.rate;
          effectiveOverflowRate = undefined;
        }

        const capState = standardCapStateByCardId.get(card.id);
        if (capState && capState.remainingPoints > 0.01) {
          let holderIndex = splitSlot ?? 0;
          let holderRemaining = capState.holderRemainingPoints[holderIndex] ?? 0;
          if (splitSlot === undefined) {
            for (let i = 0; i < capState.holderRemainingPoints.length; i++) {
              if ((capState.holderRemainingPoints[i] ?? 0) > 0.01) {
                holderIndex = i;
                holderRemaining = capState.holderRemainingPoints[i];
                break;
              }
            }
          }
          if (holderRemaining <= 0.01) continue;
          const maxSpend = Math.min(
            remainingSeg,
            maxSpendForPointsCap(holderRemaining, effectiveStandardRate, rounding)
          );
          if (maxSpend > 0.01) {
            const netRate = effectiveStandardRate - feeRate;
            candidates.push({
              card,
              phase: "standard-cap",
              effectiveRatePercent: effectiveStandardRate,
              maxSpend,
              priority: 1000 + netRate * 100,
              roundingMode: rounding,
              feeRate,
              capInitialPoints: capState.initialPoints,
              capUsesPoints: true,
              segmentSpecialNote: useCtbcOnlineLocal
                ? "線上／非面對面消費：依公告試算 3%（非實體 11%）"
                : seg.specialNote,
              holderIndex,
            });
          }
        } else if (capState && capState.remainingPoints <= 0.01 && effectiveOverflowRate) {
          const overflowRate = effectiveOverflowRate;
          const netRate = overflowRate - feeRate;
          const overflowHolder = splitSlot ?? (lastHolderByCardId.get(card.id) ?? 0);
          candidates.push({
            card,
            phase: "standard-overflow",
            effectiveRatePercent: overflowRate,
            maxSpend: remainingSeg,
            priority: netRate * 100,
            roundingMode: rounding,
            feeRate,
            capUsesPoints: false,
            segmentSpecialNote: seg.specialNote,
            holderIndex: overflowHolder,
          });
        } else {
          // uncapped for this category OR cap state not set
          if (!rule.cap) {
            if (effectiveStandardRate > 0) {
              const netRate = effectiveStandardRate - feeRate;
              const uncappedHolder = splitSlot ?? (lastHolderByCardId.get(card.id) ?? 0);
              candidates.push({
                card,
                phase: "standard-uncapped",
                effectiveRatePercent: effectiveStandardRate,
                maxSpend: remainingSeg,
                priority: netRate * 100,
                roundingMode: rounding,
                feeRate,
                capUsesPoints: false,
                segmentSpecialNote: useCtbcOnlineLocal
                  ? "線上／非面對面消費：依公告試算 3%（非實體 11%）"
                  : seg.specialNote,
                holderIndex: uncappedHolder,
              });
            }
          } else {
            // Has cap rule but cap state is exhausted and no overflow
            // Candidate is not available for this remainder.
          }
        }
      }

      if (isShoppingSplitCandidate) {
        const MIN_SWITCHABLE_SPEND = 200;
        // 實體店結帳不適合極小額切卡：剩餘加碼可刷額度低於門檻時，直接略過該候選卡。
        const filtered = candidates.filter((c) => c.maxSpend >= MIN_SWITCHABLE_SPEND);
        candidates.length = 0;
        candidates.push(...filtered);
      }

      if (candidates.length === 0) {
        if (!pushSegmentFallback(remainingSeg)) break;
        remainingSeg = 0;
        break;
      }

      const indivisibleThisStep = !!opts?.indivisible || isAtomicShopping;

      const estimateAtomicNetWithCap = (c: Candidate, need: number, capSpend: number): number => {
        const rounding = c.roundingMode;
        const fee = applyRounding((need * c.feeRate) / 100, rounding);
        const fullGross = applyRounding((need * c.effectiveRatePercent) / 100, rounding);
        if (need <= capSpend + 0.01) return fullGross - fee;
        if (c.phase === "standard-cap") {
          const rule = c.card.cashback.find((r) => r.category === category);
          const ov = rule?.overflowRate;
          const capPart = applyRounding((capSpend * c.effectiveRatePercent) / 100, rounding);
          if (ov != null) {
            const over = Math.max(0, need - capSpend);
            const overPart = applyRounding((over * ov) / 100, rounding);
            return capPart + overPart - fee;
          }
          return capPart - fee;
        }
        if (c.phase === "dbs-bonus" || c.phase === "dbs-online-bonus") {
          const base = c.baseRatePercent ?? 1;
          const capBonusPart = applyRounding((capSpend * c.effectiveRatePercent) / 100, rounding);
          const over = Math.max(0, need - capSpend);
          const overBase = Math.floor((over * base) / 100);
          return capBonusPart + overBase - fee;
        }
        if (c.phase === "kumamon-bonus") {
          const base = c.baseRatePercent ?? 2.5;
          const capBonusPart = applyRounding((capSpend * c.effectiveRatePercent) / 100, rounding);
          const over = Math.max(0, need - capSpend);
          const overBase = applyRounding((over * base) / 100, rounding);
          return capBonusPart + overBase - fee;
        }
        return Number.NEGATIVE_INFINITY;
      };
      const estimateAtomicNet = (c: Candidate, need: number): number =>
        estimateAtomicNetWithCap(c, need, c.maxSpend);

      const perHolderCapSpendForCandidate = (c: Candidate): number | undefined => {
        if (c.phase === "dbs-bonus" || c.phase === "dbs-online-bonus") return 600 / 0.04;
        if (c.phase === "kumamon-bonus") return 500 / 0.06;
        if (c.phase === "standard-cap") {
          const rule = c.card.cashback.find((r) => r.category === category);
          if (!rule?.cap || c.effectiveRatePercent <= 0.01) return undefined;
          return rule.cap / (c.effectiveRatePercent / 100);
        }
        return undefined;
      };

      const estimateAtomicSplitNet = (c: Candidate, need: number): number => {
        if (effectivePartySize <= 1) return estimateAtomicNet(c, need);
        const chunks = splitFlightTicketAmounts(need, effectivePartySize);
        const perHolderCapSpend = perHolderCapSpendForCandidate(c);
        let sum = 0;
        for (const chunk of chunks) {
          if (chunk <= 0.01) continue;
          const capSpend = perHolderCapSpend ? Math.max(c.maxSpend, perHolderCapSpend) : c.maxSpend;
          sum += estimateAtomicNetWithCap(c, chunk, capSpend);
        }
        return sum;
      };

      if (isAtomicShopping) {
        const need = remainingSeg;
        const splitBetterByCard = new Map<string, boolean>();
        const byCard = new Map<string, Candidate>();
        for (const c of candidates) {
          const key = c.card.id;
          const cur = byCard.get(key);
          if (!cur) {
            byCard.set(key, c);
            splitBetterByCard.set(
              key,
              estimateAtomicSplitNet(c, need) > estimateAtomicNet(c, need) + 0.001
            );
            continue;
          }
          const curNet = Math.max(estimateAtomicNet(cur, need), estimateAtomicSplitNet(cur, need));
          const nextNet = Math.max(estimateAtomicNet(c, need), estimateAtomicSplitNet(c, need));
          if (nextNet > curNet + 0.001 || (Math.abs(nextNet - curNet) <= 0.001 && c.priority > cur.priority)) {
            byCard.set(key, c);
            splitBetterByCard.set(
              key,
              estimateAtomicSplitNet(c, need) > estimateAtomicNet(c, need) + 0.001
            );
          }
        }
        candidates.length = 0;
        candidates.push(...Array.from(byCard.values()));
        (waterfallForCategorySegmentsV2 as unknown as Record<string, unknown>).__shopping_split_pref__ = splitBetterByCard;
      }

      candidates.sort((a, b) => {
        if (isAtomicShopping) {
          const an = estimateAtomicNet(a, remainingSeg);
          const bn = estimateAtomicNet(b, remainingSeg);
          const dn = bn - an;
          if (Math.abs(dn) > 0.001) return dn;
        }
        const d = b.priority - a.priority;
        if (Math.abs(d) > 0.001) return d;
        const ac = a.card?.id ?? "";
        const bc = b.card?.id ?? "";
        return ac.localeCompare(bc);
      });

      if (indivisibleThisStep) {
        const need = remainingSeg;
        /** 須複製陣列：若 filter 為空而改指派 `candidates`，與原陣列同參考時後續 `candidates.length = 0` 會把資料全清空，導致 chosen 為 undefined */
        let pool = candidates.filter((c) => c.maxSpend >= need - 0.01);
        if (!pool.length) pool = [...candidates];
        pool.sort((a, b) => {
          const d = b.priority - a.priority;
          if (Math.abs(d) > 0.001) return d;
          const ac = a.card?.id ?? "";
          const bc = b.card?.id ?? "";
          return ac.localeCompare(bc);
        });
        candidates.length = 0;
        candidates.push(...pool);
      }

      const chosen = candidates.find((c) => c?.card != null) ?? candidates[0];
      if (!chosen?.card) {
        if (!pushSegmentFallback(remainingSeg)) break;
        remainingSeg = 0;
        break;
      }

      const needAmt = remainingSeg;
      /** 不可分割片段（機票單張）：整筆一次分配，禁止拆成多筆或碎金額 */
      const allocated = indivisibleThisStep ? needAmt : Math.min(remainingSeg, chosen.maxSpend);
      if (allocated <= 0.009) break;

      // Compute points & update cap states.
      const enrolled = enrolledIds.has(chosen.card.id);
      let grossCashback = 0;
      let feePoints = 0;
      let netCashback = 0;

      let isCapReached = false;
      let capAmount: number | undefined = undefined;
      let isDbsEcoBonus = false;
      let isDbsEcoBaseOnly = false;
      let isKumamonBonus = false;
      let isOverflow = false;
      let specialNote: string | undefined = chosen.segmentSpecialNote;
      let needsHolderSwap = false;

      const roundingMode = chosen.roundingMode;
      if (chosen.phase === "dbs-bonus") {
        const baseRate = chosen.baseRatePercent ?? 1;
        const bonusRate = chosen.bonusRatePercent ?? 4;
        const basePoints = Math.floor((allocated * baseRate) / 100);
        const bonusPoints = Math.round((allocated * bonusRate) / 100);
        grossCashback = basePoints + bonusPoints;
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        dbsEcoBonusCapRemainingPoints = Math.max(0, dbsEcoBonusCapRemainingPoints - bonusPoints);
        if (dbsEcoBonusCapState) dbsEcoBonusCapState.remainingPoints = dbsEcoBonusCapRemainingPoints;
        isCapReached = dbsEcoBonusCapRemainingPoints <= 0.01;
        capAmount = dbsEcoBonusCapInitialPoints;
        isDbsEcoBonus = true;
        specialNote = isCapReached ? chosen.capReachedNote : seg.specialNote;
      } else if (chosen.phase === "dbs-base") {
        const baseRate = chosen.baseRatePercent ?? 1;
        grossCashback = Math.floor((allocated * baseRate) / 100);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        isDbsEcoBaseOnly = true;
      } else if (chosen.phase === "dbs-online-bonus") {
        const baseRate = chosen.baseRatePercent ?? 1;
        const bonusRate = chosen.bonusRatePercent ?? 4;
        if (opts?.indivisible && allocated > chosen.maxSpend + 0.01) {
          const capB = chosen.maxSpend;
          const overB = allocated - capB;
          const basePoints = Math.floor((allocated * baseRate) / 100);
          const bonusPoints = Math.min(
            Math.round((capB * bonusRate) / 100),
            dbsEcoBonusCapRemainingPoints
          );
          grossCashback = basePoints + bonusPoints;
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;
          dbsEcoBonusCapRemainingPoints = Math.max(0, dbsEcoBonusCapRemainingPoints - bonusPoints);
          if (dbsEcoBonusCapState) dbsEcoBonusCapState.remainingPoints = dbsEcoBonusCapRemainingPoints;
          isCapReached = dbsEcoBonusCapRemainingPoints <= 0.01;
          capAmount = dbsEcoBonusCapInitialPoints;
          isDbsEcoBonus = true;
          specialNote =
            overB > 0.01
              ? `${chosen.segmentSpecialNote ?? ""} 本筆已達上限（加碼額度內以外僅享基礎回饋）`.trim()
              : isCapReached
                ? chosen.capReachedNote
                : chosen.segmentSpecialNote;
        } else {
          const basePoints = Math.floor((allocated * baseRate) / 100);
          const bonusPoints = Math.round((allocated * bonusRate) / 100);
          grossCashback = basePoints + bonusPoints;
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;
          dbsEcoBonusCapRemainingPoints = Math.max(0, dbsEcoBonusCapRemainingPoints - bonusPoints);
          if (dbsEcoBonusCapState) dbsEcoBonusCapState.remainingPoints = dbsEcoBonusCapRemainingPoints;
          isCapReached = dbsEcoBonusCapRemainingPoints <= 0.01;
          capAmount = dbsEcoBonusCapInitialPoints;
          isDbsEcoBonus = true;
          specialNote = isCapReached ? chosen.capReachedNote : chosen.segmentSpecialNote;
        }
      } else if (chosen.phase === "dbs-online-base") {
        const baseRate = chosen.baseRatePercent ?? 1;
        grossCashback = Math.floor((allocated * baseRate) / 100);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        isDbsEcoBaseOnly = true;
      } else if (chosen.phase === "kumamon-bonus") {
        const baseRate = chosen.baseRatePercent ?? 2.5;
        const bonusRate = chosen.bonusRatePercent ?? 6;
        if (opts?.indivisible && allocated > chosen.maxSpend + 0.01) {
          const capB = chosen.maxSpend;
          const overB = allocated - capB;
          const basePoints = applyRounding((allocated * baseRate) / 100, roundingMode);
          const bonusPoints = applyRounding((capB * bonusRate) / 100, roundingMode);
          grossCashback = basePoints + bonusPoints;
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;
          if (kumamonBonusCapState) {
            kumamonBonusCapState.remainingPoints = Math.max(0, kumamonBonusCapState.remainingPoints - bonusPoints);
          }
          isCapReached = !!kumamonBonusCapState && kumamonBonusCapState.remainingPoints <= 0.01;
          capAmount = chosen.capInitialPoints;
          isKumamonBonus = true;
          isOverflow = overB > 0.01;
          specialNote =
            overB > 0.01
              ? `${seg.specialNote ?? ""} 本筆已達上限（加碼僅計入額度內金額）`.trim()
              : isCapReached
                ? chosen.capReachedNote
                : seg.specialNote;
        } else {
          const basePoints = applyRounding((allocated * baseRate) / 100, roundingMode);
          const bonusPoints = applyRounding((allocated * bonusRate) / 100, roundingMode);
          grossCashback = basePoints + bonusPoints;
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;
          if (kumamonBonusCapState) kumamonBonusCapState.remainingPoints = Math.max(0, kumamonBonusCapState.remainingPoints - bonusPoints);
          isCapReached = !!kumamonBonusCapState && kumamonBonusCapState.remainingPoints <= 0.01;
          capAmount = chosen.capInitialPoints;
          isKumamonBonus = true;
          specialNote = isCapReached ? chosen.capReachedNote : seg.specialNote;
        }
      } else if (chosen.phase === "kumamon-base") {
        const baseRate = chosen.baseRatePercent ?? 2.5;
        grossCashback = applyRounding((allocated * baseRate) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
      } else if (chosen.phase === "sinopac-bonus") {
        const baseRate = chosen.baseRatePercent ?? 2;
        const bonusRate = chosen.bonusRatePercent ?? 4;
        const basePoints = Math.floor((allocated * baseRate) / 100);
        const bonusPoints = Math.round((allocated * bonusRate) / 100);
        grossCashback = basePoints + bonusPoints;
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        sinopacBonusRemaining = Math.max(0, sinopacBonusRemaining - bonusPoints);
        isCapReached = sinopacBonusRemaining <= 0.01;
        capAmount = sinopacBonusInitial;
        specialNote = isCapReached
          ? "精選 4% 加碼月上限已達標（依登錄）"
          : chosen.segmentSpecialNote ?? seg.specialNote;
      } else if (chosen.phase === "sinopac-base") {
        const baseRate = chosen.baseRatePercent ?? 2;
        grossCashback = applyRounding((allocated * baseRate) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        specialNote = chosen.segmentSpecialNote ?? seg.specialNote;
      } else if (chosen.phase === "sinopac-newuser") {
        grossCashback = applyRounding((allocated * 10) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        sinopacNewUserRemaining = Math.max(0, sinopacNewUserRemaining - grossCashback);
        isCapReached = sinopacNewUserRemaining <= 0.01;
        capAmount = chosen.capInitialPoints;
        specialNote = isCapReached
          ? "新戶加碼合併上限已達標（依登錄）"
          : chosen.segmentSpecialNote ?? seg.specialNote;
      } else if (chosen.phase === "standard-cap") {
        const rate = chosen.effectiveRatePercent;
        const flightRule = chosen.card.cashback.find((r) => r.category === category);
        const ovRate = flightRule?.overflowRate;
        if (opts?.indivisible && allocated > chosen.maxSpend + 0.01 && ovRate != null) {
          const capSpend = chosen.maxSpend;
          const overSpend = allocated - capSpend;
          const capGross = applyRounding((capSpend * rate) / 100, roundingMode);
          const overGross = applyRounding((overSpend * ovRate) / 100, roundingMode);
          grossCashback = capGross + overGross;
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;

          const capState = standardCapStateByCardId.get(chosen.card.id);
          if (capState) {
            capState.remainingPoints = Math.max(0, capState.remainingPoints - capGross);
            const idx = chosen.holderIndex ?? 0;
            capState.holderRemainingPoints[idx] = Math.max(0, (capState.holderRemainingPoints[idx] ?? 0) - capGross);
            if ((holderCounts[chosen.card.id] ?? 1) > 1 && capState.holderRemainingPoints[idx] <= 0.01) {
              const nextHolder = idx + 2;
              if (nextHolder <= (holderCounts[chosen.card.id] ?? 1)) {
                specialNote = `⚠️ 第${idx + 1}人已達上限，請改刷第${nextHolder}人的${chosen.card.shortName}`;
                needsHolderSwap = true;
              }
            }
          }
          isCapReached = true;
          isOverflow = overSpend > 0.01;
          capAmount = chosen.capInitialPoints;
          specialNote =
            overSpend > 0.01
              ? `${chosen.segmentSpecialNote ?? ""} 本筆已達上限（超出部分依 ${ovRate}% 計）`.trim()
              : (chosen.segmentSpecialNote ?? seg.specialNote);
        } else {
          grossCashback = applyRounding((allocated * rate) / 100, roundingMode);
          feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
          netCashback = grossCashback - feePoints;

          const capState = standardCapStateByCardId.get(chosen.card.id);
          if (capState) {
            capState.remainingPoints = Math.max(0, capState.remainingPoints - grossCashback);
            const idx = chosen.holderIndex ?? 0;
            capState.holderRemainingPoints[idx] = Math.max(0, (capState.holderRemainingPoints[idx] ?? 0) - grossCashback);
            if ((holderCounts[chosen.card.id] ?? 1) > 1 && capState.holderRemainingPoints[idx] <= 0.01) {
              const nextHolder = idx + 2;
              if (nextHolder <= (holderCounts[chosen.card.id] ?? 1)) {
                specialNote = `⚠️ 第${idx + 1}人已達上限，請改刷第${nextHolder}人的${chosen.card.shortName}`;
                needsHolderSwap = true;
              }
            }
          }
          isCapReached = !!capState && capState.remainingPoints <= 0.01;
          capAmount = chosen.capInitialPoints;
          specialNote =
            holderCounts[chosen.card.id] && holderCounts[chosen.card.id] > 1 && isCapReached
              ? `${holderCounts[chosen.card.id]}人持有，需分開刷卡各享上限`
              : (chosen.segmentSpecialNote ?? seg.specialNote);
        }
      } else if (chosen.phase === "standard-overflow") {
        isOverflow = true;
        const rate = chosen.effectiveRatePercent;
        grossCashback = applyRounding((allocated * rate) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        specialNote = `超出上限部分${rate}%`;
      } else if (chosen.phase === "ic-priority") {
        const rate = chosen.effectiveRatePercent;
        grossCashback = applyRounding((allocated * rate) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
        specialNote = chosen.segmentSpecialNote ?? seg.specialNote;
        const wfState = waterfallForCategorySegmentsV2 as unknown as Record<string, unknown>;
        const slot = opts?.splitTravelerSlot ?? 0;
        if (chosen.card.id === "fubon-j") {
          const fubonKey = "__fubon_ap_ic_spend_cap__";
          const fubonHolderKey = "__fubon_ap_ic_spend_cap_by_holder__";
          if (opts?.splitTravelerSlot !== undefined) {
            const byHolder = (wfState[fubonHolderKey] as number[] | undefined) ??
              Array.from({ length: Math.max(1, holderCounts["fubon-j"] ?? 1) }, () => 2857);
            const cur = byHolder[slot] ?? 0;
            const next = Math.max(0, cur - allocated);
            byHolder[slot] = next;
            wfState[fubonHolderKey] = byHolder;
            isCapReached = next <= 0.01;
          } else {
            const cur = (wfState[fubonKey] as number | undefined) ?? ((holderCounts["fubon-j"] ?? 1) * 2857);
            const next = Math.max(0, cur - allocated);
            wfState[fubonKey] = next;
            isCapReached = next <= 0.01;
          }
        }
        if (chosen.card.id === "esun-kumamon" && opts?.splitTravelerSlot !== undefined) {
          const kmHolderKey = "__kumamon_ic_bonus_spend_cap_by_holder__";
          const byHolder = (wfState[kmHolderKey] as number[] | undefined) ??
            Array.from({ length: Math.max(1, holderCounts["esun-kumamon"] ?? 1) }, () => 500 / 0.06);
          const cur = byHolder[slot] ?? 0;
          const next = Math.max(0, cur - allocated);
          byHolder[slot] = next;
          wfState[kmHolderKey] = byHolder;
          isCapReached = next <= 0.01;
        }
      } else {
        // standard-uncapped
        const rate = chosen.effectiveRatePercent;
        grossCashback = applyRounding((allocated * rate) / 100, roundingMode);
        feePoints = applyRounding((allocated * chosen.feeRate) / 100, roundingMode);
        netCashback = grossCashback - feePoints;
      }

      let effectiveHolder = chosen.holderIndex;
      if (effectiveHolder === undefined) {
        effectiveHolder = lastHolderByCardId.get(chosen.card.id);
      }
      if (effectiveHolder === undefined) {
        effectiveHolder = 0;
      }

      const flightTravelerIdx =
        category === "flight" && opts?.flightTravelerIndex !== undefined
          ? opts.flightTravelerIndex
          : (opts?.splitTravelerSlot ?? seg.travelerIndex);

      const labels = resolveSegmentStepLabels(category, seg);
      const actionNotes = buildStepActionNotes(chosen.card.id, category, seg);

      if (
        category === "local" &&
        seg.brandId === "taiwan_hsr_all" &&
        Math.abs(chosen.effectiveRatePercent - 3.3) < 0.01 &&
        cards.some((c) => c.id === "cathay-cube") &&
        cards.some((c) => c.id === "taishin-flygo")
      ) {
        const extra =
          chosen.card.id === "cathay-cube"
            ? "同回饋亦可用台新 FlyGo（3.3%，須 Richart 扣繳＋天天刷）。"
            : chosen.card.id === "taishin-flygo"
              ? "同回饋亦可用國泰 CUBE（3.3%，須趣旅行並領券）。"
              : "";
        if (extra) {
          specialNote = specialNote ? `${specialNote} ${extra}` : extra;
        }
      }
      if (isAtomicShopping && effectivePartySize > 1) {
        const splitPref = (waterfallForCategorySegmentsV2 as unknown as Record<string, unknown>).__shopping_split_pref__ as Map<string, boolean> | undefined;
        const splitBetter = !!splitPref?.get(chosen.card.id);
        const note = splitBetter
          ? "💡 策略建議：建議這家店分開排隊結帳，避免單人加碼爆上限。"
          : "💡 策略建議：一起結帳即可。";
        specialNote = specialNote ? `${specialNote} ${note}` : note;
      }

      steps.push({
        stepIndex: stepIndexRef.v++,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        cardId: chosen.card.id,
        cardName: chosen.card.name,
        cardShortName: chosen.card.shortName,
        amount: allocated,
        cashbackRate: chosen.effectiveRatePercent,
        grossCashback,
        foreignFee: feePoints,
        netCashback,
        isCapReached,
        capAmount,
        enrolled,
        isKumamonBonus,
        isDbsEcoBonus,
        isDbsEcoBaseOnly,
        isOverflow,
        brandName: seg.brandName,
        brandId: seg.brandId,
        paymentMethod: seg.paymentMethod,
        specialNote,
        holderIndex: effectiveHolder,
        travelerIndex: flightTravelerIdx ?? effectiveHolder,
        needsHolderSwap,
        expenseLabel: seg.expenseName,
        subCategory: labels.subCategory,
        detailLabel: labels.detailLabel,
        splitGroupKey,
        splitGroupType: splitGroupKey ? "shopping" : undefined,
        baseCashback: (chosen.phase === "dbs-bonus" || chosen.phase === "dbs-online-bonus")
          ? Math.max(0, Math.floor((allocated * (chosen.baseRatePercent ?? 0)) / 100))
          : undefined,
        bonusCashback: (chosen.phase === "dbs-bonus" || chosen.phase === "dbs-online-bonus")
          ? Math.max(0, grossCashback - Math.max(0, Math.floor((allocated * (chosen.baseRatePercent ?? 0)) / 100)))
          : undefined,
        actionNotes,
      });

      lastHolderByCardId.set(chosen.card.id, effectiveHolder);

      remainingSeg -= allocated;
    }
  }

  return steps;
}

// ─── Main calculation function ─────────────────────────────────────────────

function applySinopacLevel(cards: CreditCard[], level?: 1 | 2): CreditCard[] {
  if (!level) return cards;
  const lv: 1 | 2 = level === 2 ? 2 : 1;
  const bonusCapMonthly = lv === 2 ? 800 : 300;
  const maxSpendingCeiling = SINOPAC_MAX_SPENDING_FOR_BONUS[lv];
  return cards.map((c) => {
    if (c.id !== "sinopac-doublebei") return c;
    return {
      ...c,
      sinopacBonusCapMonthly: bonusCapMonthly,
      cashback: c.cashback.map((r) => ({
        ...r,
        baseRate: 2,
        bonusRate: 4,
        bonusCap: bonusCapMonthly,
        cap: bonusCapMonthly,
        maxSpending: maxSpendingCeiling,
        rate: 6,
      })),
    };
  });
}

export function calculateOptimalCombination(
  spending: SpendingInput,
  selectedCards: CreditCard[],
  enrolledIds: Set<string>,
  patternSelections: PatternSelection[] = [],
  selectedBrands: Record<string, string> = {},
  holderCounts: Record<string, number> = {},
  isDbsEcoNewUser: boolean = false,
  kumamonWalletPaypayExcluded: boolean = false,
  kumamonFlightJpyEnabled: boolean = false,
  dateRange?: TravelDateRange,
  sinopacLevel?: 1 | 2,
  rateOpts?: { isSinopacNewUser?: boolean; isUnionJingheNewUser?: boolean },
  /** 機票依人頭拆票；每人一張不可分割 */
  partySize: number = 1
): CalculationResult | null {
  if (selectedCards.length === 0) return null;

  const cardsForCalc = applySinopacLevel(selectedCards, sinopacLevel).filter((card) => {
    const rawHeld = holderCounts[card.id];
    if (rawHeld == null) return true;
    const normalized = Math.floor(Number(rawHeld));
    return Number.isFinite(normalized) && normalized > 0;
  });
  if (cardsForCalc.length === 0) return null;

  const effectiveHolderCounts: Record<string, number> = {};
  for (const card of cardsForCalc) {
    const rawHeld = holderCounts[card.id];
    const normalized = rawHeld == null ? 1 : Math.floor(Number(rawHeld));
    effectiveHolderCounts[card.id] =
      Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
  }

  const categories: SpendingCategory[] = ["flight", "hotel", "rental", "local"];
  const stepIndexRef = { v: 1 };
  const allSteps: WaterfallStep[] = [];
  const cardById = new Map(cardsForCalc.map((c) => [c.id, c]));

  // Kumamon bonus cap (6% extra) is shared across hotel + local categories.
  const esunKumamonHolders = effectiveHolderCounts["esun-kumamon"] ?? 1;
  const kumamonBonusCapState =
    cardsForCalc.some((card) => card.id === "esun-kumamon")
      ? { remainingPoints: 500 * esunKumamonHolders, initialPoints: 500 * esunKumamonHolders }
      : null;
  const dbsEcoHolders = effectiveHolderCounts["dbs-eco"] ?? 1;
  const dbsEcoBonusCapState =
    cardsForCalc.some((card) => card.id === "dbs-eco")
      ? { remainingPoints: 600 * dbsEcoHolders, initialPoints: 600 * dbsEcoHolders }
      : null;

  for (const category of categories) {
    if (category === "hotel") {
      const expenses = spending.accommodationExpenses.filter((e) => e.amount > 0.01);
      for (const exp of expenses) {
        const categorySegments = patternSelections.filter(
          (s) => s.category === "hotel" && s.expenseId === exp.id
        );
        const segSum = categorySegments.reduce((a, s) => a + s.amount, 0);
        const scaled: PatternSelection[] =
          categorySegments.length > 0
            ? segSum > 0.01
              ? categorySegments.map((s) => ({
                  ...s,
                  amount: (s.amount / segSum) * exp.amount,
                }))
              : categorySegments
            : [
                {
                  patternId: "hotel-generic",
                  amount: exp.amount,
                  isKumamonEligible: false,
                  isRakutenJapanese: false,
                  isDbsEcoExcluded: false,
                  isKkday: false,
                  category: "hotel",
                  expenseId: exp.id,
                  expenseName: exp.name,
                  patternLabel: "訂購住宿",
                  paymentMethod: exp.paymentMethod ?? "online",
                },
              ];
        const steps = waterfallForCategorySegmentsV2(
          "hotel",
          exp.amount,
          scaled,
          cardsForCalc,
          enrolledIds,
          stepIndexRef,
          effectiveHolderCounts,
          isDbsEcoNewUser,
          kumamonWalletPaypayExcluded,
          kumamonFlightJpyEnabled,
          kumamonBonusCapState,
          dbsEcoBonusCapState,
          { indivisible: true, partySize },
          rateOpts
        );
        allSteps.push(...steps);
      }
      continue;
    }

    if (category === "flight") {
      const flightTotal = spending.flight ?? 0;
      if (flightTotal <= 0) continue;
      const flightSegs = patternSelections.filter((s) => s.category === "flight");
      const kmBefore = kumamonBonusCapState?.remainingPoints;
      const dbsBefore = dbsEcoBonusCapState?.remainingPoints;
      const restoreFlightCapState = (km?: number, dbs?: number) => {
        if (kumamonBonusCapState && km != null) kumamonBonusCapState.remainingPoints = km;
        if (dbsEcoBonusCapState && dbs != null) dbsEcoBonusCapState.remainingPoints = dbs;
      };
      const runFlightStrategy = (mode: "together" | "split"): {
        steps: WaterfallStep[];
        kmAfter?: number;
        dbsAfter?: number;
      } => {
        const out: WaterfallStep[] = [];
        restoreFlightCapState(kmBefore, dbsBefore);
        const useSplit = mode === "split" && partySize > 1;
        const tickets = useSplit ? splitFlightTicketAmounts(flightTotal, partySize) : [flightTotal];
        const multiTraveler = useSplit;
        for (let ti = 0; ti < tickets.length; ti++) {
          const ticketAmt = tickets[ti];
          if (ticketAmt <= 0) continue;
          const scaled = buildFlightSegmentsForTicket(flightSegs, ticketAmt, ti, multiTraveler);
          const steps = waterfallForCategorySegmentsV2(
            "flight",
            ticketAmt,
            scaled,
            cardsForCalc,
            enrolledIds,
            stepIndexRef,
            effectiveHolderCounts,
            isDbsEcoNewUser,
            kumamonWalletPaypayExcluded,
            kumamonFlightJpyEnabled,
            kumamonBonusCapState,
            dbsEcoBonusCapState,
            {
              indivisible: true,
              flightTravelerIndex: multiTraveler ? ti : undefined,
              splitTravelerSlot: useSplit ? ti : undefined,
              partySize,
            },
            rateOpts
          );
          out.push(...steps);
        }
        return {
          steps: out,
          kmAfter: kumamonBonusCapState?.remainingPoints,
          dbsAfter: dbsEcoBonusCapState?.remainingPoints,
        };
      };

      /** 依使用者設定的 `flightPurchaseMode` 試算，不再自動擇優覆寫 */
      const flightPurchaseMode = spending.flightPurchaseMode ?? "together";
      const wantFlightSplit = partySize > 1 && flightPurchaseMode === "split";

      const togetherRun = runFlightStrategy("together");
      const togetherNet = togetherRun.steps.reduce((sum, s) => sum + s.netCashback, 0);

      let splitRun = togetherRun;
      let splitNet = togetherNet;
      if (partySize > 1) {
        restoreFlightCapState(kmBefore, dbsBefore);
        splitRun = runFlightStrategy("split");
        splitNet = splitRun.steps.reduce((sum, s) => sum + s.netCashback, 0);
      }

      const chosenRun = partySize > 1 && wantFlightSplit ? splitRun : togetherRun;
      restoreFlightCapState(chosenRun.kmAfter, chosenRun.dbsAfter);

      const strategyNote =
        partySize > 1 && wantFlightSplit
          ? "💡 試算依您的設定：機票分開購買（每人拆票、各自上限）。"
          : partySize > 1
            ? "💡 試算依您的設定：機票一起購買（單筆總額）。"
            : "💡 機票回饋試算。";

      allSteps.push(
        ...chosenRun.steps.map((s) => ({
          ...s,
          specialNote: s.specialNote ? `${s.specialNote} ${strategyNote}` : strategyNote,
          flightStrategyTogetherNet: togetherNet,
          flightStrategySplitNet: splitNet,
        }))
      );
      continue;
    }

    const amount = category === "rental" ? spending.rental : spending.local;
    if (!amount || amount <= 0) continue;

    let categorySegments = patternSelections.filter((s) => s.category === category);
    const segSumInit = categorySegments.reduce((a, s) => a + s.amount, 0);
    if (segSumInit > amount + 0.01) {
      const scale = amount / segSumInit;
      categorySegments = categorySegments.map((s) => ({ ...s, amount: s.amount * scale }));
    }

    const wfParams = [
      cardsForCalc,
      enrolledIds,
      stepIndexRef,
      effectiveHolderCounts,
      isDbsEcoNewUser,
      kumamonWalletPaypayExcluded,
      kumamonFlightJpyEnabled,
      kumamonBonusCapState,
      dbsEcoBonusCapState,
      { partySize },
      rateOpts,
    ] as const;

    function localBrandSplitMode(brandId: string | undefined): DomesticRailPurchaseMode {
      if (brandId === "taoyuan_airport_metro") return "split";
      if (brandId && IC_BRAND_IDS.has(brandId)) return "split";
      return "together";
    }

    const SPLIT_BRAND_KEYS = [
      "taoyuan_airport_metro",
      "taiwan_hsr_all",
      "jp_ic_wallet_topup",
      "suica",
      "pasmo",
      "icoca",
    ] as const;
    const togetherSegs: PatternSelection[] = [];
    const hsrSegs: PatternSelection[] = [];
    const splitBuckets = new Map<string, PatternSelection[]>();

    if (category === "local" && partySize > 1) {
      for (const s of categorySegments) {
        const bid = s.brandId ?? "";
        if (bid === "taiwan_hsr_all") {
          hsrSegs.push(s);
          continue;
        }
        if (localBrandSplitMode(bid) === "split") {
          const list = splitBuckets.get(bid) ?? [];
          list.push(s);
          splitBuckets.set(bid, list);
        } else {
          togetherSegs.push(s);
        }
      }
    }

    const usePerBrandSplit =
      category === "local" &&
      partySize > 1 &&
      (splitBuckets.size > 0 || hsrSegs.length > 0);

    if (usePerBrandSplit) {
      const togetherSum = togetherSegs.reduce((a, s) => a + s.amount, 0);
      if (togetherSum > 0.01) {
        allSteps.push(
          ...waterfallForCategorySegmentsV2(category, togetherSum, togetherSegs, ...wfParams)
        );
      }

      const hsrSum = hsrSegs.reduce((a, s) => a + s.amount, 0);
      if (hsrSum > 0.01) {
        const kmBefore = kumamonBonusCapState?.remainingPoints;
        const dbsBefore = dbsEcoBonusCapState?.remainingPoints;
        const restoreLocalCapState = (km?: number, dbs?: number) => {
          if (kumamonBonusCapState && km != null) kumamonBonusCapState.remainingPoints = km;
          if (dbsEcoBonusCapState && dbs != null) dbsEcoBonusCapState.remainingPoints = dbs;
        };
        const runHsrStrategy = (mode: "together" | "split"): {
          steps: WaterfallStep[];
          kmAfter?: number;
          dbsAfter?: number;
        } => {
          restoreLocalCapState(kmBefore, dbsBefore);
          if (mode === "together" || partySize <= 1) {
            return {
              steps: waterfallForCategorySegmentsV2(category, hsrSum, hsrSegs, ...wfParams),
              kmAfter: kumamonBonusCapState?.remainingPoints,
              dbsAfter: dbsEcoBonusCapState?.remainingPoints,
            };
          }
          const splitSteps: WaterfallStep[] = [];
          const chunks = splitFlightTicketAmounts(hsrSum, partySize);
          for (let pi = 0; pi < chunks.length; pi++) {
            const chunkAmt = chunks[pi];
            if (chunkAmt <= 0) continue;
            const sliceScale = chunkAmt / hsrSum;
            const scaled = hsrSegs.map((s) => ({ ...s, amount: s.amount * sliceScale }));
            splitSteps.push(
              ...waterfallForCategorySegmentsV2(
                category,
                chunkAmt,
                scaled,
                cardsForCalc,
                enrolledIds,
                stepIndexRef,
                effectiveHolderCounts,
                isDbsEcoNewUser,
                kumamonWalletPaypayExcluded,
                kumamonFlightJpyEnabled,
                kumamonBonusCapState,
                dbsEcoBonusCapState,
                { splitTravelerSlot: pi, partySize },
                rateOpts
              )
            );
          }
          return {
            steps: splitSteps,
            kmAfter: kumamonBonusCapState?.remainingPoints,
            dbsAfter: dbsEcoBonusCapState?.remainingPoints,
          };
        };

        /** 依 `taiwanHsrPurchaseMode`（或舊版 domesticRailPurchaseMode）試算，不自動擇優 */
        const hsrPurchaseMode =
          spending.taiwanHsrPurchaseMode ?? spending.domesticRailPurchaseMode ?? "together";
        const wantHsrSplit = partySize > 1 && hsrPurchaseMode === "split";

        const togetherRun = runHsrStrategy("together");
        const togetherNetHsr = togetherRun.steps.reduce((s, x) => s + x.netCashback, 0);

        let splitRun = togetherRun;
        let splitNetHsr = togetherNetHsr;
        if (partySize > 1) {
          restoreLocalCapState(kmBefore, dbsBefore);
          splitRun = runHsrStrategy("split");
          splitNetHsr = splitRun.steps.reduce((s, x) => s + x.netCashback, 0);
        }

        const chosen = partySize > 1 && wantHsrSplit ? splitRun : togetherRun;
        restoreLocalCapState(chosen.kmAfter, chosen.dbsAfter);

        const note =
          partySize > 1 && wantHsrSplit
            ? "💡 試算依您的設定：高鐵分開購票（每人拆票試算）。"
            : partySize > 1
              ? "💡 試算依您的設定：高鐵一筆代購（單筆總額）。"
              : "💡 台灣高鐵回饋試算。";

        allSteps.push(
          ...chosen.steps.map((s) => ({
            ...s,
            specialNote: s.specialNote ? `${s.specialNote} ${note}` : note,
          }))
        );
      }

      const processSplitBrand = (rail: PatternSelection[]) => {
        const railSum = rail.reduce((a, s) => a + s.amount, 0);
        if (railSum <= 0.01) return;
        const chunks = splitFlightTicketAmounts(railSum, partySize);
        for (let pi = 0; pi < chunks.length; pi++) {
          const chunkAmt = chunks[pi];
          if (chunkAmt <= 0) continue;
          const sliceScale = chunkAmt / railSum;
          const railScaled = rail.map((s) => ({ ...s, amount: s.amount * sliceScale }));
          allSteps.push(
            ...waterfallForCategorySegmentsV2(
              category,
              chunkAmt,
              railScaled,
              cardsForCalc,
              enrolledIds,
              stepIndexRef,
              effectiveHolderCounts,
              isDbsEcoNewUser,
              kumamonWalletPaypayExcluded,
              kumamonFlightJpyEnabled,
              kumamonBonusCapState,
              dbsEcoBonusCapState,
              { splitTravelerSlot: pi, partySize },
              rateOpts
            )
          );
        }
      };

      for (const bid of SPLIT_BRAND_KEYS) {
        const rail = splitBuckets.get(bid);
        if (rail?.length) processSplitBrand(rail);
      }
      for (const [bid, rail] of splitBuckets) {
        if ((SPLIT_BRAND_KEYS as readonly string[]).includes(bid)) continue;
        if (rail.length) processSplitBrand(rail);
      }
      continue;
    }

    allSteps.push(
      ...waterfallForCategorySegmentsV2(category, amount, categorySegments, ...wfParams)
    );
  }

  if (allSteps.length === 0) return null;

  // Totals
  const totalSpending = allSteps.reduce((s, a) => s + a.amount, 0);
  const totalGrossCashback = allSteps.reduce((s, a) => s + a.grossCashback, 0);
  const totalForeignFee = allSteps.reduce((s, a) => s + a.foreignFee, 0);
  const totalNetCashback = allSteps.reduce((s, a) => s + a.netCashback, 0);
  const hasKumamonBonus = allSteps.some((s) => s.isKumamonBonus);
  const hasDbsEcoBonus = allSteps.some((s) => s.isDbsEcoBonus);

  // Card breakdown
  const cardMap = new Map<string, CardBreakdown>();
  for (const step of allSteps) {
    if (!cardMap.has(step.cardId)) {
      cardMap.set(step.cardId, {
        cardId: step.cardId,
        cardName: step.cardName,
        cardShortName: step.cardShortName,
        categories: [],
        spending: 0,
        netCashback: 0,
        capReached: false,
        capAmount: undefined,
        capSpendingPerHolder: undefined,
        enrolled: step.enrolled,
        usedKumamonBonus: false,
        usedDbsEcoBonus: false,
        validityWarning: undefined,
      });
    }
    const entry = cardMap.get(step.cardId)!;
    const card = cardById.get(step.cardId);
    const rangeEnd = dateRange?.to;
    if (card?.validUntil && rangeEnd) {
      const travel = parseYmdLocal(rangeEnd);
      const until = parseYmdLocal(card.validUntil);
      if (travel && until && travel > until) {
        const outFrom = new Date(until);
        outFrom.setDate(outFrom.getDate() + 1);
        const y = outFrom.getFullYear();
        const mo = String(outFrom.getMonth() + 1).padStart(2, "0");
        const d = String(outFrom.getDate()).padStart(2, "0");
        const outFromLabel = `${y}-${mo}-${d}`;
        entry.validityWarning = `⚠️ 提醒：部分旅程（${outFromLabel} 起）已超出目前公告之優惠效期`;
      }
    }
    const catLabel = step.subCategory ?? step.categoryLabel;
    if (!entry.categories.includes(catLabel)) entry.categories.push(catLabel);
    entry.spending += step.amount;
    entry.netCashback += step.netCashback;
    if (step.isCapReached) {
      entry.capReached = true;
      if (step.capAmount != null) {
        entry.capAmount = Math.max(entry.capAmount ?? 0, step.capAmount);
      }
      const holders = effectiveHolderCounts[step.cardId] ?? 1;
      // For split suggestion we only need a reasonable per-holder spending cap.
      if (step.cardId === "dbs-eco") {
        entry.capSpendingPerHolder = 600 / 0.04; // 600點 (4%) 對應約NT$15,000
      } else if (step.cardId === "esun-kumamon") {
        entry.capSpendingPerHolder = 500 / 0.06; // 500點 (6%) 對應約NT$8,333
      } else if (step.capAmount != null && step.cashbackRate > 0) {
        const capPointsPerHolder = step.capAmount / Math.max(1, holders);
        entry.capSpendingPerHolder = capPointsPerHolder / (step.cashbackRate / 100);
      }
    }
    if (step.isKumamonBonus) entry.usedKumamonBonus = true;
    if (step.isDbsEcoBonus) entry.usedDbsEcoBonus = true;
  }

  const savingsBreakdown = aggregateSavingsBreakdown(allSteps);

  return {
    waterfallSteps: allSteps,
    totalSpending,
    totalGrossCashback,
    totalForeignFee,
    totalNetCashback,
    cardBreakdown: Array.from(cardMap.values()),
    hasKumamonBonus,
    hasDbsEcoBonus,
    savingsBreakdown,
  };
}

export function formatTWD(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  return `${sign}$${new Intl.NumberFormat("zh-TW").format(abs)}`;
}

// ─── Analytics stub ────────────────────────────────────────────────────────

export function logCalculation(payload: {
  destination: string;
  spending: SpendingInput;
  patternAmounts: Record<string, number>;
  selectedCards: string[];
  enrolledCards: string[];
  selectedBrands: Record<string, string>;
  travelPartySize: number;          // For Supabase: track solo vs family travelers
  holderCountsPerCard: Record<string, number>; // For Supabase: track which cards are commonly shared
  is_kkday_used: boolean;           // For Supabase: track KKday usage rate among users
  is_dbs_eco_new_user: boolean;     // For Supabase: track new-user bonus claims
  result: CalculationResult;
}) {
  void payload;
  // 預留：寫入 Supabase / 內部分析；避免在 production 主控台輸出除錯 log
}
