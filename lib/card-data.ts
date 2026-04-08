export type SpendingCategory = "flight" | "hotel" | "rental" | "local";

export interface CashbackRule {
  category: SpendingCategory;
  rate: number;           // percentage, e.g. 3.0 means 3%
  baseRate?: number;      // for cards with base + bonus structure (e.g. DBS eco 1% base)
  bonusRate?: number;     // bonus portion (e.g. DBS eco 4% bonus)
  label: string;
  cap?: number;           // max cashback (TWD) for this rule per billing cycle; undefined = no cap
  maxSpending?: number;   // spending ceiling derived from cap/bonus-cap rule
  maxSpendingIsApprox?: boolean; // true when converted from non-integer ceiling
  bonusCap?: number;      // max bonus cashback (points/TWD) - separate from total cap
  ruleNote?: string;      // short per-rule annotation shown under the rate
  overflowRate?: number;  // rate after cap is reached (e.g. CTBC 3% after 11% cap)
}

// Card perks / additional benefits
export interface CardPerks {
  shuttle?: number;        // 機場接送次數 per year
  lounge?: number;         // 貴賓室次數 per year
  insurance?: number;      // 旅平險金額 (萬)
  roadside?: number;       // 道路救援次數 per year
}

export interface CreditCard {
  id: string;
  name: string;
  shortName: string;
  bank: string;
  annualFee: number;  // TWD per year, 0 = free
  cashback: CashbackRule[];
  foreignFee: number; // percentage, e.g. 1.5; 0 if dual-currency / no fee
  noForeignFee?: boolean;
  color: string;      // tailwind bg classes for visual only
  notes?: string;
  registrationUrl: string;  // link to enrollment page
  registrationBonus?: { type: "percent" | "fixed"; value: number; note?: string };
  tags: string[];           // e.g. ["推薦", "Apple Pay"]
  validUntil?: string;      // promo validity end date (YYYY-MM-DD)
  perks?: CardPerks;        // additional card benefits
  kumamonBonusRate?: number;       // Special rate for designated Kumamon merchants
  kumamonHotelRakutenRate?: number; // Kumamon rate for Rakuten JP hotel only
  kumamonHotelOtherRate?: number;   // Kumamon rate for non-Rakuten hotels
  // DBS eco specific
  dbsEcoExcludedBrands?: string[]; // brands excluded from 4% bonus (e.g. SUICA, PASMO)
  // Rounding mode
  roundingMode?: "round" | "floor"; // "round" = 四捨五入, "floor" = 無條件捨去
}

export const FOREIGN_FEE = 1.5;

// Brands excluded from DBS eco 4% bonus
export const DBS_ECO_EXCLUDED_BRANDS = new Set(["suica", "pasmo", "icoca"]);

export const CREDIT_CARDS: CreditCard[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. 星展 eco 永續卡 (DBS eco) — NEW
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dbs-eco",
    name: "星展eco永續卡",
    shortName: "星展eco",
    bank: "星展銀行",
    annualFee: 0,
    color: "bg-emerald-800",
    registrationUrl: "https://www.dbs.com.tw/",
    registrationBonus: { type: "percent", value: 1.0, note: "登錄活動加碼" },
    tags: ["推薦", "Apple Pay", "實體5%"],
    validUntil: "2026-06-30",
    cashback: [
      { category: "flight", rate: 1.0, label: "訂購機票", ruleNote: "線上消費僅1%" },
      { category: "hotel",  rate: 1.0, label: "住宿網站", ruleNote: "線上消費僅1%" },
      { category: "rental", rate: 1.0, label: "租車費用", ruleNote: "線上消費僅1%" },
      { 
        category: "local",  
        rate: 5.0, 
        baseRate: 1.0,
        bonusRate: 4.0,
        bonusCap: 600, // 600 points cap for 4% bonus
        maxSpending: 15000,
        label: "當地實體消費",
        ruleNote: "實體門市5%（1%+4%加碼），約NT$15,000達上限"
      },
    ],
    foreignFee: FOREIGN_FEE,
    dbsEcoExcludedBrands: ["suica", "pasmo", "icoca"],
    roundingMode: "round", // 點數四捨五入至整數
    notes: "日韓泰等指定地區實體門市面對面刷卡（含Apple Pay）享5%。4%加碼每期上限600點（約NT$15,000達上限）。SUICA/PASMO/ICOCA儲值僅享1%基礎回饋。",
    perks: { shuttle: 2, lounge: 4, insurance: 3000 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. 中信 UNI$AV卡 (CTBC UniOpen) — UPDATED with overflow
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ctbc-uniopen",
    name: "中信 UNI$AV卡",
    shortName: "中信UniOpen",
    bank: "中國信託",
    annualFee: 0,
    color: "bg-zinc-800",
    registrationUrl: "https://www.ctbcbank.com/",
    registrationBonus: { type: "percent", value: 1.0, note: "指定活動額外加碼" },
    tags: ["推薦", "最高回饋"],
    cashback: [
      { category: "flight", rate: 11.0, label: "訂購機票", cap: 500, maxSpending: 5000 },
      {
        category: "hotel",
        rate: 12.5,
        label: "住宿網站",
        cap: 500,
        maxSpending: 5000,
        ruleNote: "限 Expedia / Hotels.com / 雄獅指定網頁",
      },
      { category: "rental", rate: 11.0, label: "租車費用", cap: 500, maxSpending: 5000 },
      { 
        category: "local",  
        rate: 11.0, 
        label: "當地實體消費", 
        cap: 500,
        maxSpending: 5000,
        overflowRate: 3.0, // After cap, drops to 3% unlimited
        ruleNote: "上限NT$500後降為3%無上限"
      },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "住宿12.5%（限Expedia/Hotels.com/雄獅）、實體11%（上限NT$500，超出3%無上限）。Agoda另享Mastercard世界卡9折 / 鈦金卡92折。",
    perks: { shuttle: 2, lounge: 4, insurance: 5000, roadside: 3 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. 台新FlyGo卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "taishin-flygo",
    name: "台新FlyGo卡",
    shortName: "台新FlyGo",
    bank: "台新銀行",
    annualFee: 0,
    color: "bg-zinc-700",
    registrationUrl: "https://www.taishinbank.com.tw/",
    registrationBonus: { type: "percent", value: 1.0, note: "指定通路登錄加碼" },
    tags: ["Apple Pay", "機票住宿強"],
    cashback: [
      { category: "flight", rate: 5.0, label: "訂購機票", cap: 1200, maxSpending: 24000 },
      { category: "hotel",  rate: 5.0, label: "住宿網站",  cap: 1200, maxSpending: 24000 },
      { category: "rental", rate: 2.8, label: "租車費用",  cap: 500, maxSpending: 17857, maxSpendingIsApprox: true  },
      { category: "local",  rate: 2.8, label: "當地實體消費", cap: 800, maxSpending: 28571, maxSpendingIsApprox: true },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "機票/住宿5%（各上限NT$1200），海外2.8%（上限NT$800）",
    perks: { shuttle: 2, lounge: 2, insurance: 3000 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 4. 富邦J卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fubon-j",
    name: "富邦J卡",
    shortName: "富邦J",
    bank: "台北富邦",
    annualFee: 0,
    color: "bg-zinc-700",
    registrationUrl: "https://www.fubon.com/banking/",
    tags: ["免年費"],
    cashback: [
      { category: "flight", rate: 3.0, label: "訂購機票", cap: 400, maxSpending: 13333, maxSpendingIsApprox: true },
      { category: "hotel",  rate: 3.0, label: "住宿網站",  cap: 400, maxSpending: 13333, maxSpendingIsApprox: true },
      { category: "rental", rate: 1.0, label: "租車費用" },
      { category: "local",  rate: 1.0, label: "當地實體消費" },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "機票/住宿3%（各上限NT$400），其他海外1%",
    perks: { lounge: 2, insurance: 2000 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 5. 聯邦吉鶴卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "union-jinghe",
    name: "聯邦吉鶴卡",
    shortName: "聯邦吉鶴",
    bank: "聯邦銀行",
    annualFee: 0,
    color: "bg-zinc-600",
    registrationUrl: "https://www.unionbank.com.tw/",
    tags: ["推薦", "無上限"],
    cashback: [
      { category: "flight", rate: 7.0, label: "訂購機票" },
      { category: "hotel",  rate: 7.0, label: "住宿網站" },
      { category: "rental", rate: 7.0, label: "租車費用" },
      { category: "local",  rate: 7.0, label: "當地實體消費" },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "全海外消費7%，無加碼上限（需每月最低消費達標）",
    perks: { shuttle: 1, insurance: 2000 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 國泰CUBE卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "cathay-cube",
    name: "國泰CUBE卡",
    shortName: "國泰CUBE",
    bank: "國泰世華",
    annualFee: 0,
    color: "bg-zinc-600",
    registrationUrl: "https://www.cathaybk.com.tw/",
    tags: ["Apple Pay", "Google Pay"],
    cashback: [
      { category: "flight", rate: 1.2, label: "訂購機票" },
      { category: "hotel",  rate: 2.2, label: "住宿網站",  cap: 500, maxSpending: 22727, maxSpendingIsApprox: true },
      { category: "rental", rate: 1.2, label: "租車費用" },
      { category: "local",  rate: 2.2, label: "當地實體消費", cap: 800, maxSpending: 36363, maxSpendingIsApprox: true },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "住宿/海外實體2.2%（各上限NT$500/800），其他1.2%",
    perks: { shuttle: 2, lounge: 6, insurance: 5000, roadside: 2 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 7. 玉山熊本熊卡 (E.SUN Kumamon) — 2026 權益文件
  // - 住宿：樂天日文版 8.5%，其他（Agoda/Booking等）2.5%
  // - 指定通路：8.5%（BicCamera、Uniqlo、迪士尼、ORIX租車等）
  // - 計算：每筆無條件捨去至整數
  // - 需扣除 1.5% 國外手續費成本
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "esun-kumamon",
    name: "玉山熊本熊卡",
    shortName: "玉山熊本熊",
    bank: "玉山銀行",
    annualFee: 0,
    color: "bg-zinc-500",
    registrationUrl: "https://www.esunbank.com.tw/",
    registrationBonus: { type: "percent", value: 0.5, note: "活動登錄加碼" },
    tags: ["指定通路8.5%"],
    validUntil: "2026-06-30",
    cashback: [
      { category: "flight", rate: 1.0, label: "訂購機票" },
      {
        category: "hotel",
        rate: 8.5, // 顯示用：最高可達 8.5%（限樂天日文版）；其餘在計算引擎會落回 2.5%
        baseRate: 2.5,
        bonusRate: 6.0,
        bonusCap: 500,
        maxSpending: 8333,
        maxSpendingIsApprox: true,
        label: "住宿網站",
        ruleNote:
          "限樂天旅遊（日文版）享8.5%（2.5%+6%）；其他僅2.5%。6%加碼上限 NT$500/期（hotel+local 共享）",
      },
      { category: "rental", rate: 1.0, label: "租車費用" },
      {
        category: "local",
        rate: 8.5, // 顯示用：指定通路最高 8.5%；非指定在計算引擎會落回 2.5%
        baseRate: 2.5,
        bonusRate: 6.0,
        bonusCap: 500,
        maxSpending: 8333,
        maxSpendingIsApprox: true,
        label: "當地實體消費",
        ruleNote:
          "指定通路享8.5%（2.5%+6%）：BicCamera/Uniqlo/迪士尼/USJ/哈利波特/預付交通IC（SUICA等）/ORIX租車等。非指定僅2.5%。（6%加碼上限 NT$500/期，與 hotel 共享）",
      },
    ],
    foreignFee: FOREIGN_FEE, // 固定扣除 1.5% 手續費
    noForeignFee: false,     // 非免手續費
    kumamonBonusRate: 8.5,
    kumamonHotelRakutenRate: 8.5, // 樂天日文版
    kumamonHotelOtherRate: 2.5,   // 非樂天日文版
    roundingMode: "floor",        // 每筆無條件捨去
    notes: "熊本熊卡：hotel（樂天日文版）與 local（指定通路）享 8.5%（2.5%基礎+6%加碼）。6% 加碼每期上限 NT$500（hotel+local 共享），計算採逐筆無條件捨去，並扣 1.5% 國外手續費。",
    perks: { lounge: 2, insurance: 1500 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 8. 永豐幣倍卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "sinopac-doublebei",
    name: "永豐幣倍卡",
    shortName: "永豐幣倍",
    bank: "永豐銀行",
    annualFee: 0,
    color: "bg-zinc-500",
    registrationUrl: "https://bank.sinopac.com/",
    registrationBonus: { type: "percent", value: 1.0, note: "任務登錄加碼" },
    tags: ["雙幣卡", "免手續費"],
    cashback: [
      { category: "flight", rate: 6.0, label: "訂購機票", cap: 600, maxSpending: 10000 },
      { category: "hotel",  rate: 6.0, label: "住宿網站",  cap: 600, maxSpending: 10000 },
      { category: "rental", rate: 6.0, label: "租車費用",  cap: 600, maxSpending: 10000 },
      { category: "local",  rate: 6.0, label: "當地實體消費", cap: 600, maxSpending: 10000 },
    ],
    foreignFee: 0,
    noForeignFee: true,
    notes: "全海外6%（各類上限NT$600），雙幣卡免手續費",
    perks: { shuttle: 1, insurance: 2500, roadside: 2 },
  },
];

export const CATEGORIES: { key: SpendingCategory; label: string }[] = [
  { key: "flight", label: "訂購機票" },
  { key: "hotel",  label: "住宿網站" },
  { key: "rental", label: "租車費用" },
  { key: "local",  label: "當地實體消費" },
];
