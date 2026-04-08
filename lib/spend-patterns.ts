// Step 3: Spending pattern categories (merchant types)
// These map to SpendingCategory for card-rate lookup.

import { SpendingCategory } from "./card-data";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BrandItem {
  id: string;
  name: string;
  unitPrice?: number;           // Default unit price in TWD
  isKumamonEligible?: boolean;  // qualifies for Kumamon 8.5%
  isRakutenJapanese?: boolean;  // special flag for Kumamon hotel logic
  isDbsEcoExcluded?: boolean;   // excluded from DBS eco 4% bonus (e.g. SUICA)
  isKkday?: boolean;            // sold / purchased via KKday platform
  specialNote?: string;
  /** UI：交通等類別的醒目子選項 */
  highlight?: boolean;
}

/** A named group of brands within a pattern (e.g. "IC卡儲值" inside transport) */
export interface BrandGroup {
  id: string;
  label: string;
  perPerson: boolean;      // whether this specific sub-group is per-person
  manualInput?: boolean;   // true = show a text input instead of +/- counter (for shopping totals)
  brands: BrandItem[];
}

export interface SpendingPattern {
  id: string;
  label: string;
  examples: string;
  category: SpendingCategory;
  icon: string;
  /** true = the ENTIRE pattern is per-person (no sub-groups).
   *  When subGroups is present this field is ignored — each subGroup has its own perPerson. */
  perPerson: boolean;
  brands?: BrandItem[];      // flat brand list (no sub-groups)
  subGroups?: BrandGroup[];  // hierarchical brand groups (overrides brands)
}

// ── Hotel booking brands (used in Step 2 directly) ────────────────────────────

export const HOTEL_BOOKING_BRANDS: BrandItem[] = [
  {
    id: "hotel_direct",
    name: "飯店官網",
    unitPrice: 12000,
    specialNote: "直接於飯店官方網站或電話訂房並線上刷卡（通路認列依各卡公告）",
  },
  { id: "agoda", name: "Agoda", unitPrice: 15000, isKkday: true },
  {
    id: "trip_hotel",
    name: "Trip.com",
    unitPrice: 14000,
    isKkday: true,
    specialNote: "Trip.com 視為一般海外/線上旅遊平台；熊本熊卡先以 2.5% 計算",
  },
  {
    id: "rakuten_travel_jp",
    name: "樂天旅遊（日文版）",
    unitPrice: 12000,
    isKkday: true,
    isKumamonEligible: true,
    isRakutenJapanese: true,
    specialNote: "熊本熊卡8.5%需使用日文版（travel.rakuten.co.jp）",
  },
  {
    id: "rakuten_travel_tw",
    name: "樂天旅遊（中文版）",
    unitPrice: 12000,
    isKkday: true,
    specialNote: "熊本熊卡僅享2.5%，建議改用日文版",
  },
  { id: "hotels_com", name: "Hotels.com", unitPrice: 15000, isKkday: true },
  { id: "booking", name: "Booking.com", unitPrice: 15000, isKkday: true },
  {
    id: "klook_hotel",
    name: "Klook",
    unitPrice: 12000,
    isKkday: true,
    specialNote: "國泰 CUBE 日本賞：日本指定商品可評估 6%，其餘情境以 3.5% 試算",
  },
  {
    id: "expedia",
    name: "Expedia",
    unitPrice: 18000,
    isKkday: true,
    specialNote: "中信UniOpen可享12.5%回饋",
  },
  { id: "airbnb", name: "Airbnb", unitPrice: 10000, isKkday: true },
  {
    id: "kkday_hotel",
    name: "KKday",
    unitPrice: 12000,
    isKkday: true,
    specialNote: "適合購買 JR Pass、樂園門票、網卡。星展新戶享5%；非新戶僅1%。",
  },
];

/** Step 2 住宿平台下拉（id 對應 HOTEL_BOOKING_BRANDS） */
export const HOTEL_PLATFORM_DROPDOWN_IDS: string[] = [
  "agoda",
  "booking",
  "klook_hotel",
  "trip_hotel",
  "rakuten_travel_jp",
  "rakuten_travel_tw",
  "hotels_com",
  "expedia",
  "airbnb",
  "kkday_hotel",
  "hotel_direct",
];

export const FLIGHT_BOOKING_BRANDS: BrandItem[] = [
  {
    id: "trip_flight",
    name: "Trip.com",
    unitPrice: 13000,
    isKkday: true,
    specialNote: "旅遊平台機票：台新 FlyGo / 星展新戶可作為 5% 評估",
  },
  {
    id: "jal",
    name: "日本航空 JAL",
    unitPrice: 15000,
    isKkday: true,
    isKumamonEligible: true,
    specialNote: "熊本熊卡僅在 JAL 官網且日圓結帳情境可評估 8.5%",
  },
  {
    id: "ana",
    name: "全日空 ANA",
    unitPrice: 15000,
    isKkday: true,
    isKumamonEligible: true,
    specialNote: "熊本熊卡僅在 ANA 官網且日圓結帳情境可評估 8.5%",
  },
  { id: "tigerair", name: "Tigerair 台灣虎航", unitPrice: 9000, isKkday: true },
  { id: "peach", name: "Peach 樂桃航空", unitPrice: 8000, isKkday: true },
  { id: "starlux", name: "Starlux 星宇航空", unitPrice: 12000, isKkday: true },
  { id: "eva_air", name: "EVA Air 長榮航空", unitPrice: 13000, isKkday: true },
  { id: "china_airlines", name: "China Airlines 華航", unitPrice: 13000, isKkday: true },
];

// ── Eligibility sets ──────────────────────────────────────────────────────────

export const KUMAMON_ELIGIBLE_BRANDS = new Set([
  "disney_tokyo", "disney_sea", "usj", "harry_potter_tokyo", "harry_potter_osaka",
  "fuji_q", "ghibli", "legoland",
  "uniqlo", "gu", "bic_camera", "yodobashi",
  "rakuten_travel_jp",
  "suica", "pasmo", "icoca", "jp_ic_wallet_topup",
  "orix", "toyota_rent", "times_car", "nippon_rent", "ots",
]);

export const DBS_ECO_EXCLUDED_BRANDS = new Set([
  "suica", "pasmo", "icoca", "jp_ic_wallet_topup", "t_money",
]);

// ── Pattern definitions ───────────────────────────────────────────────────────

export const SPENDING_PATTERNS: SpendingPattern[] = [

  // ── 1. 交通 — three sub-groups with different perPerson rules ──────────────
  {
    id: "transport",
    label: "交通費用",
    examples: "SUICA / JR Pass / 租車",
    category: "local",
    icon: "Train",
    perPerson: true,  // default; overridden per subGroup
    subGroups: [
      {
        id: "ic_card",
        label: "日本交通卡儲值",
        perPerson: true,
        brands: [
          {
            id: "jp_ic_wallet_topup",
            name: "📱 日本交通卡儲值 (Suica / PASMO / ICOCA)",
            unitPrice: 5000,
            isDbsEcoExcluded: true,
            isKumamonEligible: true,
            highlight: true,
            specialNote:
              "Apple Pay 儲值：富邦 J 可評估 10%、台新 FlyGo 玩旅刷可評估 3.3%；星展 eco 不計入 4% 加碼。可切換「Apple Pay 儲值」與支付方式試算。",
          },
        ],
      },
      {
        id: "rental",
        label: "自駕租車",
        perPerson: false,  // total price for the group
        brands: [
          {
            id: "toyota_rent",
            name: "TOYOTA Rent a Car",
            unitPrice: 8000,
            isKumamonEligible: true,
          },
          {
            id: "times_car",
            name: "Times Car",
            unitPrice: 7000,
            isKumamonEligible: true,
          },
          {
            id: "nippon_rent",
            name: "日本租車（Nippon Rent-A-Car）",
            unitPrice: 8000,
            isKumamonEligible: true,
          },
          {
            id: "ots",
            name: "OTS 租車",
            unitPrice: 7000,
            isKumamonEligible: true,
          },
          {
            id: "orix",
            name: "ORIX 租車",
            unitPrice: 8000,
            isKumamonEligible: true,
            specialNote: "現場出示熊本熊卡享租車折扣",
          },
        ],
      },
      {
        id: "jr_ticket",
        label: "鐵路購票",
        perPerson: true,
        brands: [
          { id: "jr_pass_7", name: "JR Pass 7日", unitPrice: 31000 },
          { id: "jr_pass_14", name: "JR Pass 14日", unitPrice: 49000 },
          { id: "jr_kyushu", name: "JR 九州鐵路周遊券", unitPrice: 10000 },
          { id: "jr_hokuriku", name: "JR 北陸拱形鐵路券", unitPrice: 8500 },
          { id: "shinkansen", name: "新幹線單程票", unitPrice: 13000 },
          {
            id: "kkday_jr",
            name: "透過 KKday 購 JR Pass",
            unitPrice: 31000,
            isKkday: true,
            specialNote: "適合購買 JR Pass、網卡。台新FlyGo享5%；星展新戶享5%（600點上限）。",
          },
        ],
      },
    ],
  },

  // ── 2. 日本主題樂園 — by region, all per-person ───────────────────────────
  {
    id: "theme_park",
    label: "日本主題樂園",
    examples: "迪士尼 / 環球影城 / 哈利波特",
    category: "local",
    icon: "Sparkles",
    perPerson: true,
    subGroups: [
      {
        id: "tokyo_parks",
        label: "東京地區",
        perPerson: true,
        brands: [
          {
            id: "disney_tokyo",
            name: "東京迪士尼樂園",
            unitPrice: 9400,
            isKumamonEligible: true,
          },
          {
            id: "disney_sea",
            name: "東京迪士尼海洋",
            unitPrice: 9400,
            isKumamonEligible: true,
          },
          {
            id: "harry_potter_tokyo",
            name: "哈利波特影城（東京）",
            unitPrice: 6300,
            isKumamonEligible: true,
          },
          {
            id: "sanrio_puroland",
            name: "三麗鷗彩虹樂園",
            unitPrice: 4500,
          },
          {
            id: "kkday_tokyo_park",
            name: "透過 KKday 購票",
            unitPrice: 9400,
            isKkday: true,
            specialNote: "適合購買樂園門票。台新FlyGo享5%；星展新戶享5%（600點上限）。",
          },
        ],
      },
      {
        id: "kansai_parks",
        label: "關西地區",
        perPerson: true,
        brands: [
          {
            id: "usj",
            name: "日本環球影城（USJ）",
            unitPrice: 8600,
            isKumamonEligible: true,
          },
          {
            id: "harry_potter_osaka",
            name: "哈利波特影城（大阪）",
            unitPrice: 6300,
            isKumamonEligible: true,
          },
          {
            id: "legoland_osaka",
            name: "LEGOLAND 大阪",
            unitPrice: 3800,
          },
        ],
      },
      {
        id: "chubu_parks",
        label: "中部地區",
        perPerson: true,
        brands: [
          {
            id: "fuji_q",
            name: "富士急樂園",
            unitPrice: 6800,
            isKumamonEligible: true,
          },
          {
            id: "ghibli",
            name: "吉卜力公園",
            unitPrice: 3500,
            isKumamonEligible: true,
          },
          {
            id: "legoland_nagoya",
            name: "LEGOLAND 名古屋",
            unitPrice: 3000,
          },
        ],
      },
      {
        id: "kyushu_parks",
        label: "九州地區",
        perPerson: true,
        brands: [
          { id: "huis_ten_bosch", name: "豪斯登堡", unitPrice: 4500 },
          { id: "spaceworld", name: "太空世界", unitPrice: 3000 },
        ],
      },
    ],
  },

  // ── 3. 購物 — sub-groups by category, all total ────────────────────────────
  {
    id: "shopping",
    label: "購物消費",
    examples: "BicCamera / 松本清 / 無印良品",
    category: "local",
    icon: "ShoppingBag",
    perPerson: false,
    subGroups: [
      {
        id: "lifestyle_brands",
        label: "生活雜貨 / 服飾",
        perPerson: false,
        manualInput: true,
        brands: [
          {
            id: "uniqlo",
            name: "Uniqlo",
            unitPrice: 5000,
            isKumamonEligible: true,
          },
          {
            id: "gu",
            name: "GU",
            unitPrice: 3000,
            isKumamonEligible: true,
          },
          { id: "muji", name: "無印良品（MUJI）", unitPrice: 5000 },
          { id: "daiso", name: "大創 DAISO", unitPrice: 1000 },
          { id: "nitori", name: "宜得利 Nitori", unitPrice: 5000 },
          { id: "hands", name: "東急Hands", unitPrice: 3000 },
        ],
      },
      {
        id: "drugstore_brands",
        label: "藥妝店",
        perPerson: false,
        manualInput: true,
        brands: [
          {
            id: "matsumoto",
            name: "松本清",
            unitPrice: 5000,
            isKumamonEligible: true,
          },
          {
            id: "don_quijote",
            name: "唐吉軻德",
            unitPrice: 8000,
            isKumamonEligible: true,
          },
          { id: "sundrug", name: "SunDrug", unitPrice: 4000 },
          { id: "welcia", name: "Welcia", unitPrice: 3000 },
          { id: "kokumin", name: "Kokumin", unitPrice: 3000 },
        ],
      },
      {
        id: "electronics_brands",
        label: "3C 家電",
        perPerson: false,
        manualInput: true,
        brands: [
          {
            id: "bic_camera",
            name: "BicCamera",
            unitPrice: 30000,
            isKumamonEligible: true,
          },
          {
            id: "wamazing",
            name: "完美行購物 WAmazing",
            unitPrice: 12000,
          },
          {
            id: "yodobashi",
            name: "Yodobashi Camera",
            unitPrice: 25000,
            isKumamonEligible: true,
          },
          { id: "yamada", name: "山田電機", unitPrice: 20000 },
          { id: "edion", name: "Edion", unitPrice: 15000 },
        ],
      },
    ],
  },

  // ── 4. 餐廳 / 美食 — total ────────────────────────────────────────────────
  {
    id: "dining",
    label: "餐廳 / 美食",
    examples: "拉麵 / 燒肉 / 壽司",
    category: "local",
    icon: "UtensilsCrossed",
    perPerson: false,
    brands: [
      { id: "ichiran", name: "一蘭拉麵", unitPrice: 1500 },
      { id: "yakiniku", name: "燒肉店", unitPrice: 4000 },
      { id: "izakaya", name: "居酒屋", unitPrice: 3000 },
      { id: "sushi_restaurant", name: "壽司店", unitPrice: 5000 },
      { id: "ramen", name: "其他拉麵店", unitPrice: 1200 },
      { id: "cafe", name: "咖啡廳", unitPrice: 800 },
    ],
  },

  // ── 5. 百貨公司 — total ───────────────────────────────────────────────────
  {
    id: "department",
    label: "百貨公司",
    examples: "三越伊勢丹 / 高島屋",
    category: "local",
    icon: "Building2",
    perPerson: false,
    brands: [
      { id: "mitsukoshi_isetan", name: "三越伊勢丹", unitPrice: 10000 },
      { id: "mitsui_outlet_park", name: "三井 Outlet（MITSUI OUTLET PARK）", unitPrice: 12000 },
      { id: "takashimaya", name: "高島屋", unitPrice: 8000 },
      { id: "daimaru_matsuzakaya", name: "大丸松坂屋", unitPrice: 8000 },
      { id: "lumine", name: "Lumine", unitPrice: 5000 },
      { id: "parco", name: "Parco", unitPrice: 5000 },
    ],
  },

  // ── 6. 超市 / 超商 — total ───────────────────────────────────────────────
  {
    id: "convenience",
    label: "超市 / 超商",
    examples: "7-Eleven / 全家 / AEON",
    category: "local",
    icon: "Store",
    perPerson: false,
    brands: [
      { id: "seven_eleven", name: "7-Eleven", unitPrice: 500 },
      { id: "family_mart", name: "全家 FamilyMart", unitPrice: 500 },
      { id: "lawson", name: "Lawson", unitPrice: 500 },
      { id: "aeon", name: "AEON", unitPrice: 3000 },
      { id: "ok_store", name: "OK Store", unitPrice: 2000 },
    ],
  },

  // ── 7. 線上訂票（機票） — per-person ────────────────────────────────────────
  {
    id: "flight_booking",
    label: "線上訂機票",
    examples: "JAL / ANA / 樂桃",
    category: "flight",
    icon: "Plane",
    perPerson: true,
    brands: [
      {
        id: "jal",
        name: "日本航空 JAL",
        unitPrice: 15000,
      },
      {
        id: "ana",
        name: "全日空 ANA",
        unitPrice: 15000,
      },
      {
        id: "trip_flight",
        name: "Trip.com",
        unitPrice: 13000,
        isKkday: true,
        specialNote: "Trip.com 旅遊平台：台新 FlyGo 依平台通路規則可享 5%",
      },
      { id: "peach", name: "樂桃航空 Peach", unitPrice: 8000 },
      { id: "jetstar", name: "捷星 Jetstar", unitPrice: 7000 },
      { id: "korean_air", name: "大韓航空", unitPrice: 12000 },
    ],
  },

];
