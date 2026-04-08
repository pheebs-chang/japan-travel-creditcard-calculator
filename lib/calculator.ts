import { CreditCard, SpendingCategory, FOREIGN_FEE, CashbackRule, DBS_ECO_EXCLUDED_BRANDS } from "./card-data";
import { SPENDING_PATTERNS, HOTEL_BOOKING_BRANDS, FLIGHT_BOOKING_BRANDS } from "./spend-patterns";

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

export interface SpendingInput {
  flight: number;
  accommodationExpenses: AccommodationExpense[];
  rental: number;
  local: number;
  /** Step2 機票區塊：預設線上 */
  flightPaymentMethod?: PaymentChannel;
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
  paymentOpts?: MergePatternPaymentOptions
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

export interface CalculationResult {
  waterfallSteps: WaterfallStep[];
  totalSpending: number;
  totalGrossCashback: number;
  totalForeignFee: number;
  totalNetCashback: number;
  cardBreakdown: CardBreakdown[];
  hasKumamonBonus: boolean;
  hasDbsEcoBonus: boolean;
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
  // 中信 UniOpen overflow logic
  // ═══════════════════════════════════════════════════════════════════════════
  // Handled during waterfall allocation, not here

  // 永豐幣倍：新戶加碼（試算 +1%，依登錄）
  if (card.id === "sinopac-doublebei" && rateOpts?.isSinopacNewUser) {
    return {
      rate: Math.min(rule.rate + 1, 10),
      cap: rule.cap,
      overflowRate: rule.overflowRate,
      isKumamonBonus: false,
      isDbsEcoBonus: false,
      isDbsEcoBaseOnly: false,
      specialNote: "新戶額外加碼試算 +1%（依登錄）",
    };
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
  opts?: { indivisible?: boolean; flightTravelerIndex?: number },
  rateOpts?: { isSinopacNewUser?: boolean; isUnionJingheNewUser?: boolean }
): WaterfallStep[] {
  if (totalAmount <= 0) return [];

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
    if (card.id === "dbs-eco" || card.id === "esun-kumamon") continue;
    const rule = card.cashback.find((r) => r.category === category);
    if (!rule || rule.cap === undefined) continue;
    const holders = holderCounts[card.id] ?? 1;
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
    const splitGroupKey = isShoppingSplitCandidate
      ? `shopping:${segIdx}:${seg.brandId ?? seg.brandName ?? seg.patternId}`
      : undefined;
    /** 同一消費片段內，每張卡最後一次刷卡對應的持卡人索引（溢出／降階步驟繼承用） */
    const lastHolderByCardId = new Map<string, number>();
    while (remainingSeg > 0.01) {
      type Candidate = {
        card: CreditCard;
        phase: "dbs-bonus" | "dbs-base" | "dbs-online-bonus" | "dbs-online-base" | "kumamon-bonus" | "kumamon-base" | "fubon-ap-ic" | "union-ap" | "standard-cap" | "standard-uncapped" | "standard-overflow";
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

      for (const card of cards) {
        const enrolled = enrolledIds.has(card.id);
        const roundingMode = getCardRoundingMode(card);
        const feeRate = card.noForeignFee ? 0 : (card.foreignFee ?? FOREIGN_FEE);

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
        if (card.id === "sinopac-doublebei" && rateOpts?.isSinopacNewUser) {
          effectiveStandardRate = Math.min(effectiveStandardRate + 1, 10);
        }

        const capState = standardCapStateByCardId.get(card.id);
        if (capState && capState.remainingPoints > 0.01) {
          let holderIndex = 0;
          let holderRemaining = capState.holderRemainingPoints[0] ?? 0;
          for (let i = 0; i < capState.holderRemainingPoints.length; i++) {
            if ((capState.holderRemainingPoints[i] ?? 0) > 0.01) {
              holderIndex = i;
              holderRemaining = capState.holderRemainingPoints[i];
              break;
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
          const overflowHolder = lastHolderByCardId.get(card.id) ?? 0;
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
              const uncappedHolder = lastHolderByCardId.get(card.id) ?? 0;
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

      if (candidates.length === 0) {
        // Should rarely happen; consume the remainder with the first card to keep UI stable.
        const fallbackCard = cards[0];
        const rule = fallbackCard.cashback.find((r) => r.category === category);
        if (!rule) break;
        const roundingMode = getCardRoundingMode(fallbackCard);
        const feeRate = fallbackCard.noForeignFee ? 0 : (fallbackCard.foreignFee ?? FOREIGN_FEE);
        const gross = applyRounding((remainingSeg * rule.rate) / 100, roundingMode);
        const fee = applyRounding((remainingSeg * feeRate) / 100, roundingMode);
        const net = gross - fee;
        const labels = resolveSegmentStepLabels(category, seg);
        const fallbackHolder = lastHolderByCardId.get(fallbackCard.id) ?? 0;
        steps.push({
          stepIndex: stepIndexRef.v++,
          category,
          categoryLabel: CATEGORY_LABELS[category],
          cardId: fallbackCard.id,
          cardName: fallbackCard.name,
          cardShortName: fallbackCard.shortName,
          amount: remainingSeg,
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
        });
        lastHolderByCardId.set(fallbackCard.id, fallbackHolder);
        remainingSeg = 0;
        break;
      }

      candidates.sort((a, b) => b.priority - a.priority);

      if (opts?.indivisible) {
        const need = remainingSeg;
        let pool = candidates.filter((c) => c.maxSpend >= need - 0.01);
        if (!pool.length) pool = candidates;
        pool.sort((a, b) => b.priority - a.priority);
        candidates.length = 0;
        candidates.push(...pool);
      }

      const chosen = candidates[0];
      const needAmt = remainingSeg;
      /** 不可分割片段（機票單張）：整筆一次分配，禁止拆成多筆或碎金額 */
      const allocated = opts?.indivisible ? needAmt : Math.min(remainingSeg, chosen.maxSpend);
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
          : seg.travelerIndex;

      const labels = resolveSegmentStepLabels(category, seg);
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
  const cap = level === 2 ? 800 : 300;
  return cards.map((c) => {
    if (c.id !== "sinopac-doublebei") return c;
    return {
      ...c,
      sinopacBonusCapMonthly: cap,
      cashback: c.cashback.map((r) => ({
        ...r,
        cap,
        maxSpending: r.rate > 0 ? Math.round((cap / r.rate) * 100) : r.maxSpending,
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

  const cardsForCalc = applySinopacLevel(selectedCards, sinopacLevel);

  const categories: SpendingCategory[] = ["flight", "hotel", "rental", "local"];
  const stepIndexRef = { v: 1 };
  const allSteps: WaterfallStep[] = [];
  const cardById = new Map(cardsForCalc.map((c) => [c.id, c]));

  // Kumamon bonus cap (6% extra) is shared across hotel + local categories.
  const esunKumamonHolders = holderCounts["esun-kumamon"] ?? 1;
  const kumamonBonusCapState =
    cardsForCalc.some((card) => card.id === "esun-kumamon")
      ? { remainingPoints: 500 * esunKumamonHolders, initialPoints: 500 * esunKumamonHolders }
      : null;
  const dbsEcoHolders = holderCounts["dbs-eco"] ?? 1;
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
          holderCounts,
          isDbsEcoNewUser,
          kumamonWalletPaypayExcluded,
          kumamonFlightJpyEnabled,
          kumamonBonusCapState,
          dbsEcoBonusCapState,
          { indivisible: true },
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
      const tickets = splitFlightTicketAmounts(flightTotal, partySize);
      const multiTraveler = partySize > 1;
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
          holderCounts,
          isDbsEcoNewUser,
          kumamonWalletPaypayExcluded,
          kumamonFlightJpyEnabled,
          kumamonBonusCapState,
          dbsEcoBonusCapState,
          { indivisible: true, flightTravelerIndex: multiTraveler ? ti : undefined },
          rateOpts
        );
        allSteps.push(...steps);
      }
      continue;
    }

    const amount = category === "rental" ? spending.rental : spending.local;
    if (!amount || amount <= 0) continue;

    const categorySegments = patternSelections.filter((s) => s.category === category);
    const steps = waterfallForCategorySegmentsV2(
      category,
      amount,
      categorySegments,
      cardsForCalc,
      enrolledIds,
      stepIndexRef,
      holderCounts,
      isDbsEcoNewUser,
      kumamonWalletPaypayExcluded,
      kumamonFlightJpyEnabled,
      kumamonBonusCapState,
      dbsEcoBonusCapState,
      undefined,
      rateOpts
    );
    allSteps.push(...steps);
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
      const holders = holderCounts[step.cardId] ?? 1;
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

  return {
    waterfallSteps: allSteps,
    totalSpending,
    totalGrossCashback,
    totalForeignFee,
    totalNetCashback,
    cardBreakdown: Array.from(cardMap.values()),
    hasKumamonBonus,
    hasDbsEcoBonus,
  };
}

export function formatTWD(amount: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
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
  // Log for debugging - this payload structure is ready for Supabase insertion
  console.log("[logCalculation]", JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
    // Fields ready for Supabase
    travel_party_size: payload.travelPartySize,
    total_holders_per_card: payload.holderCountsPerCard,
    is_kkday_used: payload.is_kkday_used,
    is_dbs_eco_new_user: payload.is_dbs_eco_new_user,
  }, null, 2));
}
