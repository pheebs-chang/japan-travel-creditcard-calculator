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
  /** 永豐幣倍卡：Level 1/2 對應加碼上限（元/月），由 UI 切換後寫入規則 */
  sinopacBonusCapMonthly?: number;
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
    notes: "指定地區實體面對面享1%+4%加碼（每期600點／約NT$15,000）。⚠️ Apple Pay 儲值 SUICA／PASMO 不計入4%加碼，僅1%；非儲值之實體刷卡仍可依公告享加碼。活動須登錄。",
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
    tags: ["推薦", "實體11%"],
    cashback: [
      {
        category: "flight",
        rate: 3.0,
        label: "訂購機票",
        cap: 500,
        maxSpending: 16666,
        ruleNote: "線上交易：依公告基本+指定加碼（非國外實體11%）",
      },
      {
        category: "hotel",
        rate: 3.0,
        label: "住宿網站",
        cap: 500,
        maxSpending: 16666,
        ruleNote: "網路訂房不適用實體面對面11%結構",
      },
      { category: "rental", rate: 3.0, label: "租車費用", cap: 500, maxSpending: 16666, ruleNote: "線上／非實體面對面依公告" },
      {
        category: "local",
        rate: 11.0,
        label: "國外實體消費",
        cap: 500,
        maxSpending: 5000,
        overflowRate: 3.0,
        ruleNote: "僅限國外實體面對面（含手機Pay）；結構為2%+3%+6%限額（月上限500點）。網路／第三方不加碼",
      },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "國外實體商店最高11%（含行動Pay）。網路交易、第三方支付不予加碼，試算以較保守線上費率呈現。",
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
    tags: ["Richart", "玩旅刷3.3%"],
    validUntil: "2026-06-30",
    cashback: [
      {
        category: "flight",
        rate: 3.3,
        label: "訂購機票",
        cap: 1200,
        maxSpending: 36363,
        ruleNote: "精選通路玩旅刷 3.3%（含指定航空／平台，活動 2026/04/01–06/30）",
      },
      {
        category: "hotel",
        rate: 3.3,
        label: "住宿網站",
        cap: 1200,
        maxSpending: 36363,
        ruleNote: "Agoda、Booking、Klook、KKday、雄獅、易遊網等精選通路",
      },
      {
        category: "rental",
        rate: 3.3,
        label: "租車費用",
        cap: 1200,
        maxSpending: 36363,
        ruleNote: "海外／精選旅遊通路（依公告）",
      },
      {
        category: "local",
        rate: 3.3,
        label: "當地實體消費",
        cap: 1200,
        maxSpending: 36363,
        ruleNote:
          "海外實體+精選（含 Apple Pay 儲值交通卡等）；台灣高鐵購票可評估 3.3% 台新 Point（官網／T-EX App／車站臨櫃等，依登錄）。須搭配 Richart 帳戶自動扣繳卡款並切換「天天刷」方案。本試算之高鐵金額與 CUBE 高鐵列同為未逐筆扣除帳單回饋上限之模型，實際仍依銀行公告。假日一般消費 2% 請以銀行公告為準",
      },
    ],
    foreignFee: FOREIGN_FEE,
    notes:
      "Richart／FlyGo 玩旅刷精選通路 3.3%（2026/04/01–06/30）。含海外實體及線上、指定航空、Uber／Grab、Apple Pay 儲值 SUICA／ICOCA／PASMO、訂房平台等。台灣高鐵：官網、T-EX 行動購票、車站售票窗口等享 3.3% 台新 Point（須 Richart 自動扣繳＋「天天刷」）。當期一般消費達 NT$20,000 享機場接送禮遇（依登錄）。",
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
    tags: ["免年費", "日本實體6%"],
    cashback: [
      { category: "flight", rate: 3.0, label: "訂購機票", cap: 400, maxSpending: 13333, maxSpendingIsApprox: true },
      { category: "hotel", rate: 3.0, label: "住宿網站", cap: 400, maxSpending: 13333, maxSpendingIsApprox: true },
      { category: "rental", rate: 3.0, label: "租車費用", cap: 400, maxSpending: 13333, maxSpendingIsApprox: true },
      {
        category: "local",
        rate: 6.0,
        label: "日本實體消費",
        cap: 400,
        maxSpending: 6666,
        ruleNote: "日本實體最高6%；Apple Pay 儲值 Suica/PASMO/ICOCA 單筆滿 NT$2,000 另有加碼（見試算引擎）",
      },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "日本實體最高 6%。Apple Pay 儲值日本 Suica／PASMO／ICOCA 單筆滿 NT$2,000：3%+7% 加碼（季上限 NT$200，約 NT$2,857 刷卡額）。",
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
    tags: ["日幣2.5%", "Apple Pay"],
    cashback: [
      { category: "flight", rate: 2.5, label: "訂購機票", ruleNote: "依公告日幣／海外消費" },
      { category: "hotel", rate: 2.5, label: "住宿網站" },
      { category: "rental", rate: 2.5, label: "租車費用" },
      {
        category: "local",
        rate: 2.5,
        label: "當地實體消費",
        ruleNote: "日幣消費 2.5% 無上限；Apple Pay 另享加碼（引擎內評估）。大眾運輸感應支付另有活動上限",
      },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "日幣消費 2.5% 無上限。綁定 Apple Pay 加碼最高 2.5%（依登錄／帳單）。日本大眾運輸 AP 感應（非儲值）另有回饋活動（月上限 1,000 日圓等，試算以基礎費率為主）。",
    perks: { shuttle: 1, insurance: 2000 },
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 6. 國泰CUBE卡
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "cathay-cube",
    name: "國泰世華 CUBE 卡",
    shortName: "國泰CUBE",
    bank: "國泰世華",
    annualFee: 0,
    color: "bg-zinc-600",
    registrationUrl: "https://www.cathaybk.com.tw/cathaybk/promo/event/credit-card/product/japanrewards/index.html",
    registrationBonus: { type: "percent", value: 0, note: "日本賞方案需先領券啟用；指定通路最高 10%" },
    tags: ["日本賞", "需領券", "Apple Pay", "Google Pay"],
    cashback: [
      { category: "flight", rate: 3.5, label: "訂購機票", ruleNote: "日本賞預設 3.5%；指定通路／期間活動依券後加碼試算" },
      { category: "hotel",  rate: 3.5, label: "住宿網站", ruleNote: "一般 3.5%；Hotels.com/Expedia 券後最高 10%" },
      { category: "rental", rate: 3.5, label: "租車費用", ruleNote: "日本賞一般回饋 3.5%" },
      { category: "local",  rate: 3.5, label: "當地實體消費", ruleNote: "日本賞一般 3.5%；指定通路券後可達 5%/8%/10%。國內：桃園機捷感應過閘 5%（日本賞）；台灣高鐵全通路 3.3%（趣旅行＋App 領券）" },
    ],
    foreignFee: FOREIGN_FEE,
    notes: "預設日本賞方案：日本一般實體 3.5% 無上限。國內交通另有專屬邏輯：桃園機捷感應過閘 5%（需日本賞）；台灣高鐵 3.3%（需趣旅行且 App 領券）。",
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
    registrationUrl:
      "https://card.esunbank.com.tw/EsunCreditweb/txnservice/Activity/RegisterEvent?EventId=KU2512&mac=665f4f4fc547cbcac6f3799523e320b7ce10cae170343350f9095a425e2ed115&PRJCD=ACTIVITY#b",
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
          "指定通路享8.5%（2.5%+6%）：BicCamera/Uniqlo/GU/松本清/迪士尼/USJ/哈利波特/預付交通IC（SUICA等）/ORIX租車等。非指定僅2.5%。（6%加碼上限 NT$500/期，與 hotel 共享）",
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
    registrationUrl: "https://mma.sinopac.com/SinoCard/Activity/Register?Code=XE90",
    registrationBonus: { type: "percent", value: 1.0, note: "任務登錄加碼" },
    tags: ["雙幣卡", "免手續費", "Level加碼"],
    sinopacBonusCapMonthly: 300,
    cashback: [
      {
        category: "flight",
        rate: 6.0,
        label: "訂購機票",
        cap: 300,
        maxSpending: 5000,
        ruleNote: "試算以合併費率 6% 近似（基本2%+精選+4%，加碼上限依 Level）",
      },
      {
        category: "hotel",
        rate: 6.0,
        label: "住宿網站",
        cap: 300,
        maxSpending: 5000,
      },
      {
        category: "rental",
        rate: 6.0,
        label: "租車費用",
        cap: 300,
        maxSpending: 5000,
      },
      {
        category: "local",
        rate: 6.0,
        label: "國外實體／精選",
        cap: 300,
        maxSpending: 5000,
        ruleNote: "國外實體、SUICA 儲值、Agoda、Klook 等；新戶另+4% 依公告",
      },
    ],
    foreignFee: 0,
    noForeignFee: true,
    notes: "國外基本 2% 無上限；精選通路 +4%（Level 1 月上限 NT$300／Level 2 月上限 NT$800，於選卡區切換）。新戶加碼依公告。雙幣卡免海外手續費。",
    perks: { shuttle: 1, insurance: 2500, roadside: 2 },
  },
];

export const CATEGORIES: { key: SpendingCategory; label: string }[] = [
  { key: "flight", label: "訂購機票" },
  { key: "hotel",  label: "住宿網站" },
  { key: "rental", label: "租車費用" },
  { key: "local",  label: "當地實體消費" },
];
