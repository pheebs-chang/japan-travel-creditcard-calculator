"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Copy,
  Check,
  Download,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Share2,
  Plane,
  Hotel,
  ShoppingBag,
  Train,
  Car,
  Sofa,
  Shield,
  Wrench,
  Star,
  Info,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CREDIT_CARDS } from "@/lib/card-data";
import {
  CalculationResult,
  calculateOptimalCombination,
  formatTWD,
  type PatternSelection,
  type SpendingInput,
  type TravelDateRange,
  type WaterfallStep,
  type SavingsBreakdown,
} from "@/lib/calculator";
import { cn } from "@/lib/utils";

const CUBE_COUPON_URL =
  "https://www.cathaybk.com.tw/cathaybk/promo/event/credit-card/product/japanrewards/index.html";
const IC_TOPUP_IDS = new Set(["suica", "pasmo", "icoca", "jp_ic_wallet_topup"]);

/** 預留 GA4／gtag：辦卡、登錄連結等轉換追蹤（目前為 no-op，接入時在此呼叫 gtag / dataLayer） */
export function trackConversion(
  cardName: string,
  kind: "apply_card" | "register_task" = "apply_card"
): void {
  void cardName;
  void kind;
  if (typeof window === "undefined") return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") {
    // 例：gtag("event", "conversion", { send_to: "...", ... });
  }
}

/** 與試算引擎同步，供「單卡的全額試算」重跑 */
export interface ResultPanelRecommendationContext {
  mergedSpending: SpendingInput;
  patternSelections: PatternSelection[];
  selectedBrands: Record<string, string>;
  holderCounts: Record<string, number>;
  enrolledCards: string[];
  selectedCardIds: string[];
  isDbsEcoNewUser: boolean;
  kumamonWalletPaypayExcluded: boolean;
  isKumamonFlightJpy: boolean;
  dateRange?: TravelDateRange;
  sinopacLevel?: 1 | 2;
  isSinopacNewUser: boolean;
  isUnionJingheNewUser: boolean;
  partySize: number;
}

const RIGHTS_UPDATE_LABEL = "權益更新日期：2026/04/08";
const DATA_SOURCE_NOTE =
  "本工具數據來自各發卡銀行官網，權益可能隨時變動，實際回饋依銀行最終帳單為準。";
const LEGAL_CREDIT_ALERT = "謹慎理財，信用至上";
const LEGAL_CYCLE_RATE_LINE =
  "循環信用利率：5%~15%，基準日：2026/04/08。預借現金手續費：預借金額x3%+NT$100。";
const PRIVACY_STATEMENT =
  "隱私權聲明：本站為創業驗證工具，僅進行即時試算，不會儲存任何使用者的信用卡卡號、身分證字號或個人消費紀錄。我們僅使用匿名 Cookie 進行流量統計。";

const CARD_APPLY_URLS: Record<string, string> = {
  "esun-kumamon": "https://www.esunbank.com.tw/bank/personal/credit-card/intro/bank-card/kumamon-card",
  "cathay-cube": "https://www.cathaybk.com.tw/cathaybk/promo/event/credit-card/product/cube/index.html",
  "fubon-j": "https://www.fubon.com/banking/personal/credit-card/all_card/omiyage/omiyage.htm",
  "sinopac-doublebei":
    "https://bank.sinopac.com/sinopacbank/personal/credit-card/introduction/dual-currency/index.html",
  "taishin-flygo": "https://www.taishinbank.com.tw/TSB/personal/credit/intro/flygo/",
  "union-jinghe": "https://ubot.cc/JiheCard/",
  "ctbc-uniopen": "https://www.ctbcbank.com.tw/twrbo/zh_tw/cc_index/cc_product/cc_card_introduction/UNI.html",
  "dbs-eco": "https://www.dbs.com.tw/personal-zh/cards/eco-card/index.html",
};

const APPLY_RECOMMENDATION_CARD_IDS = [
  "esun-kumamon",
  "cathay-cube",
  "fubon-j",
  "sinopac-doublebei",
  "taishin-flygo",
  "union-jinghe",
  "ctbc-uniopen",
  "dbs-eco",
] as const;

/** 辦卡 CTA 按鈕漸層（依品牌區分） */
const CARD_APPLY_BUTTON_CLASS: Record<string, string> = {
  "esun-kumamon":
    "bg-gradient-to-r from-rose-600 to-violet-700 hover:from-rose-500 hover:to-violet-600 shadow-md shadow-rose-900/25",
  "cathay-cube":
    "bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 shadow-md shadow-indigo-900/30",
  "fubon-j":
    "bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 shadow-md shadow-blue-900/25",
  "sinopac-doublebei":
    "bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 shadow-md shadow-emerald-900/20",
  "taishin-flygo":
    "bg-gradient-to-r from-violet-700 to-fuchsia-700 hover:from-violet-600 hover:to-fuchsia-600 shadow-md shadow-violet-900/25",
  "union-jinghe":
    "bg-gradient-to-r from-sky-700 to-blue-800 hover:from-sky-600 hover:to-blue-700 shadow-md shadow-sky-900/20",
  "ctbc-uniopen":
    "bg-gradient-to-r from-slate-800 to-zinc-900 hover:from-slate-700 hover:to-zinc-800 shadow-md shadow-black/25",
  "dbs-eco": "bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 shadow-md shadow-red-950/30",
};

const CARD_CORE_HIGHLIGHT: Record<string, string> = {
  "esun-kumamon": "日本指定通路最高 8.5% 小樹點（每期加碼有上限，依公告）",
  "cathay-cube": "日本賞 3.5% 無上限，指定通路券後加碼；國內交通／高鐵另有專屬試算",
  "fubon-j": "日韓實體最高 6%；Apple Pay 儲值交通 IC 滿額可評估 10%（加碼有上限）",
  "sinopac-doublebei": "精選海外最高 6% 試算；雙幣卡免海外手續費（依公告）",
  "taishin-flygo": "玩旅刷精選通路 3.3%，涵蓋海外實體／線上旅遊（依公告）",
  "union-jinghe": "日幣／海外一般消費 2.5% 試算（依帳單認列）",
  "ctbc-uniopen": "國外實體最高 11%（月上限點數，試算採保守規則）",
  "dbs-eco": "指定地區實體 5% 試算（4% 加碼每期 600 點上限）",
};

function ApplyCardLegalBlock() {
  return (
    <div className="mt-1.5 w-full space-y-0.5">
      <p className="block w-full text-[10px] font-semibold leading-snug text-muted-foreground">
        {LEGAL_CREDIT_ALERT}
      </p>
      <p className="block w-full text-[9px] leading-relaxed text-muted-foreground/75">
        {LEGAL_CYCLE_RATE_LINE} 實際年費、違約金與各項費率依發卡機構最新約定為準。
      </p>
    </div>
  );
}

/** 登錄任務列表底部：合規警語獨立一區，不與標題列搶版面 */
function RegistrationFooterLegalBlock() {
  return (
    <div className="mt-2 block w-full border-t border-border/60 pt-3 dark:border-white/10">
      <p className="block w-full text-[10px] font-semibold leading-snug text-muted-foreground">
        {LEGAL_CREDIT_ALERT}
      </p>
      <p className="mt-1 block w-full text-[10px] leading-relaxed text-muted-foreground/80">
        {LEGAL_CYCLE_RATE_LINE} 實際年費、違約金與各項費率依發卡機構最新約定為準。
      </p>
    </div>
  );
}

function DataRecencyBlock({ className }: { className?: string }) {
  return (
    <div className={cn("text-[10px] text-muted-foreground/80 leading-relaxed", className)}>
      <p className="font-medium text-muted-foreground">{RIGHTS_UPDATE_LABEL}</p>
      <p className="mt-0.5">{DATA_SOURCE_NOTE}</p>
    </div>
  );
}

interface ResultPanelProps {
  result: CalculationResult | null;
  destination: "日本" | "韓國";
  stepNumber?: number;
  partySize?: number;
  holderCounts?: Record<string, number>;
  /** 與目前試算相同參數，用於單卡潛在回饋試算 */
  recommendationContext?: ResultPanelRecommendationContext | null;
}

function strategyEmoji(subCategory: string | undefined, detailLabel: string | undefined): string {
  const sub = subCategory ?? "";
  const detail = detailLabel ?? "";
  const blob = `${sub}${detail}`;
  if (/藥妝|松本清|マツキヨ|matsukiyo|welcia|ainz|cosme|ドラッグ/i.test(blob)) return "💊";
  if (/超商|便利|7-?11|全家|lawson|familymart|セブン/i.test(blob)) return "🏪";
  if (/交通|JR|地鐵|電車|新幹線|suica|pasmo|icoca|pass/i.test(blob)) return "🚆";
  if (/訂購機票|機票/.test(sub)) return "✈️";
  if (/訂購住宿|住宿網站/.test(sub)) return "🏨";
  if (/租車/.test(sub)) return "🚗";
  if (/購物|服飾|百貨|outlet/i.test(sub)) return "🛍️";
  if (/餐飲|美食|餐廳/.test(sub)) return "🍽️";
  if (/實體|當地/.test(sub)) return "🛍️";
  return "📌";
}

const IC_TOPUP_BRAND_IDS = new Set(["suica", "pasmo", "icoca", "jp_ic_wallet_topup"]);

/** 攻略列前方防呆標籤（依卡片＋消費情境） */
function strategyDisclaimerPrefix(step: WaterfallStep): string | null {
  if (step.cardId === "ctbc-uniopen") {
    if (step.category === "hotel") return "[限現場實體結帳]";
    if (step.category === "local") {
      const blob = `${step.subCategory ?? ""}${step.detailLabel ?? ""}`;
      if (/交通|IC|SUICA|PASMO|儲值|ICOCA|租車|JR|鐵路/i.test(blob)) return null;
      return "[限現場實體結帳]";
    }
  }
  const ic = step.brandId && IC_TOPUP_BRAND_IDS.has(step.brandId);
  if (
    ic &&
    (step.cardId === "fubon-j" || step.cardId === "esun-kumamon")
  ) {
    return "[限綁定Apple Pay]";
  }
  return null;
}

function formatStrategySourceLine(step: WaterfallStep): string {
  const sub = step.subCategory ?? step.categoryLabel;
  const detail = step.detailLabel;
  const subStr = sub ?? "";
  /** 標題已含圖示（如機捷／高鐵）時不再疊加 strategyEmoji */
  const hasLeadingTransportEmoji = /^[🚄🚅🚃🚆✈️🏨🚗🛍️🍽️💊🏪📌]/u.test(subStr);
  const emoji = hasLeadingTransportEmoji ? "" : strategyEmoji(step.subCategory ?? sub, detail);
  if (step.category === "hotel" && step.expenseLabel && !step.detailLabel) {
    return `${emoji} 訂購住宿（${step.expenseLabel}）`;
  }
  if (detail) {
    return hasLeadingTransportEmoji
      ? `${sub}（${detail}）`
      : `${emoji} ${sub}（${detail}）`;
  }
  return hasLeadingTransportEmoji ? subStr : `${emoji} ${sub}`;
}

function formatStrategyCardLine(step: WaterfallStep, partySize: number): string {
  if (step.travelerIndex !== undefined && partySize > 1) {
    return `👤 旅客 ${step.travelerIndex + 1} 的 ${step.cardShortName}卡`;
  }
  return step.cardName;
}

/** 操作提醒標籤前綴：已含圖示則不再加；其餘領券類 💡，其餘 ⚠️ */
function prefixActionNoteLabel(note: string): string {
  if (/^\s*[💡⚠️]/u.test(note)) return note;
  if (/領券|^\s*APP\b/u.test(note)) return `💡 ${note}`;
  return `⚠️ ${note}`;
}

const CUBE_PRE_SPEND_REMINDER =
  "💡 刷前必做：切換方案 (日本賞/趣旅行) ＋ 領加碼券";
const FLYGO_PRE_SPEND_REMINDER =
  "💡 刷前必做：切換天天刷方案 ＋ Richart 扣繳";

function transportTopupRankTag(step: WaterfallStep): string | null {
  if (!IC_TOPUP_IDS.has(step.brandId ?? "")) return null;
  if (step.cardId === "fubon-j") return "[交通儲值首選]";
  if (step.cardId === "esun-kumamon") return "[交通儲值次選]";
  return null;
}

/** 推薦區「主要省在」：以步驟層級加總淨回饋，對齊機票／住宿／租車／國內鐵路／日本店名等情境 */
function recommendationStepKey(step: WaterfallStep, partySize: number): string {
  if (step.category === "flight") {
    if (step.travelerIndex != null && partySize > 1) {
      return `訂購機票（旅客 ${step.travelerIndex + 1}）`;
    }
    return "訂購機票";
  }
  if (step.category === "hotel") {
    return step.expenseLabel ? `住宿（${step.expenseLabel}）` : "訂購住宿";
  }
  if (step.category === "rental") return "租車費用";
  if (step.category === "local") {
    if (step.brandId === "taoyuan_airport_metro") return "桃園機場捷運";
    if (step.brandId === "taiwan_hsr_all") return "台灣高鐵";
    if (step.brandId === "taiwan_rail_all") return "台灣鐵路";
    const blob = `${step.detailLabel ?? ""}${step.subCategory ?? ""}`;
    if (/松本清|マツキヨ|matsukiyo/i.test(blob)) return "松本清";
    if (/唐吉訶德|donki/i.test(blob)) return "唐吉訶德";
    const clean = (step.detailLabel ?? "").replace(/^[🛍️🚆💊🏪]+\s*/u, "").trim();
    if (clean.length > 0 && clean.length <= 28) return clean;
    const sub = (step.subCategory ?? "").replace(/^[🛍️🚄🚅🚃]+\s*/u, "").trim();
    if (sub && sub !== "實體消費") return sub.length > 28 ? `${sub.slice(0, 26)}…` : sub;
    return "日本當地消費";
  }
  return "其他";
}

function netCashbackByRecommendationKey(
  steps: WaterfallStep[],
  partySize: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of steps) {
    const k = recommendationStepKey(s, partySize);
    m.set(k, (m.get(k) ?? 0) + s.netCashback);
  }
  return m;
}

/** 相較目前方案，加入該卡後「淨回饋」貢獻最大之單一情境（步驟彙總優先，必要時對齊 savingsBreakdown 粗項） */
function findPrimaryMarginalSaving(
  currentSteps: WaterfallStep[],
  nextSteps: WaterfallStep[],
  partySize: number,
  currentBd: SavingsBreakdown,
  nextBd: SavingsBreakdown
): { label: string; delta: number } | null {
  const cur = netCashbackByRecommendationKey(currentSteps, partySize);
  const nxt = netCashbackByRecommendationKey(nextSteps, partySize);
  let bestLabel = "";
  let bestDelta = 0;
  const keys = new Set<string>([...cur.keys(), ...nxt.keys()]);
  for (const k of keys) {
    const d = (nxt.get(k) ?? 0) - (cur.get(k) ?? 0);
    if (d > bestDelta) {
      bestDelta = d;
      bestLabel = k;
    }
  }
  const coarse: { label: string; k: keyof SavingsBreakdown }[] = [
    { label: "訂購機票", k: "flightNet" },
    { label: "訂購住宿", k: "hotelNet" },
    { label: "國內交通", k: "domesticTransportNet" },
    { label: "日本購物與當地消費", k: "japanShoppingNet" },
  ];
  for (const { label, k } of coarse) {
    const d = nextBd[k] - currentBd[k];
    if (d > bestDelta) {
      bestDelta = d;
      bestLabel = label;
    }
  }
  if (bestDelta <= 0) return null;
  return { label: bestLabel, delta: Math.round(bestDelta) };
}

type CardStrategyGroup = {
  key: string;
  cardId: string;
  cardName: string;
  cardShortName: string;
  holderIndex: number;
  firstStepIndex: number;
  steps: WaterfallStep[];
  totalAmount: number;
  totalNet: number;
  actionNotes: string[];
};

function collectCardActionNotes(steps: WaterfallStep[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  if (steps.some((s) => s.cardId === "cathay-cube")) {
    out.push(CUBE_PRE_SPEND_REMINDER);
    seen.add(CUBE_PRE_SPEND_REMINDER);
  }
  if (steps.some((s) => s.cardId === "taishin-flygo")) {
    out.push(FLYGO_PRE_SPEND_REMINDER);
    seen.add(FLYGO_PRE_SPEND_REMINDER);
  }

  for (const s of steps) {
    if (s.cardId === "cathay-cube" || s.cardId === "taishin-flygo") continue;
    for (const n of s.actionNotes ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

function buildCardStrategyGroups(steps: WaterfallStep[]): CardStrategyGroup[] {
  const groups = new Map<string, WaterfallStep[]>();
  for (const s of steps) {
    const holder = s.holderIndex ?? 0;
    const key = `${s.cardId}::${holder}`;
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const first = list[0];
      const totalAmount = list.reduce((sum, s) => sum + s.amount, 0);
      const totalNet = list.reduce((sum, s) => sum + s.netCashback, 0);
      return {
        key,
        cardId: first.cardId,
        cardName: first.cardName,
        cardShortName: first.cardShortName,
        holderIndex: first.holderIndex ?? 0,
        firstStepIndex: Math.min(...list.map((s) => s.stepIndex)),
        steps: [...list].sort((a, b) => a.stepIndex - b.stepIndex),
        totalAmount,
        totalNet,
        actionNotes: collectCardActionNotes(list),
      };
    })
    .sort((a, b) => a.firstStepIndex - b.firstStepIndex);
}

function buildShoppingStrategySummary(steps: WaterfallStep[]): string[] {
  const lines: string[] = [];
  const groups = new Map<string, WaterfallStep[]>();
  for (const s of steps) {
    if (s.splitGroupType !== "shopping" || !s.splitGroupKey) continue;
    const list = groups.get(s.splitGroupKey) ?? [];
    list.push(s);
    groups.set(s.splitGroupKey, list);
  }
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const store = list[0].detailLabel ?? list[0].brandName ?? "該商店";
    const cards = Array.from(new Set(list.map((x) => x.cardShortName)));
    if (cards.length < 2) continue;
    const firstCardAmount = list
      .filter((x) => x.cardId === list[0].cardId)
      .reduce((sum, x) => sum + x.amount, 0);
    lines.push(
      `🛍️ 在 ${store}，前 ${formatTWD(firstCardAmount)} 請刷 [${cards[0]}]，超過的部分請改刷 [${cards[1]}]`
    );
  }
  return lines;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        highlight
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card"
      )}
    >
      <p className={cn("text-xs font-medium", highlight ? "text-background/60" : "text-muted-foreground")}>
        {label}
      </p>
      <p className={cn("text-xl font-bold font-mono mt-1 tracking-tight leading-tight", highlight ? "text-background" : "text-foreground")}>
        {value}
      </p>
      {sub && (
        <p className={cn("text-[10px] mt-1", highlight ? "text-background/50" : "text-muted-foreground/70")}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function ResultPanel({
  result,
  destination,
  stepNumber = 4,
  partySize = 1,
  holderCounts = {},
  recommendationContext = null,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedStrategy, setCopiedStrategy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  if (!result) {
    return (
      <section aria-label="計算結果">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-4">
          Step {stepNumber} — 最優刷卡組合結果
        </h2>
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">請輸入消費金額並選擇至少一張信用卡</p>
          <p className="text-xs text-muted-foreground/60 mt-1">系統將自動計算 Waterfall 最優刷卡組合</p>
        </div>
        <DataRecencyBlock className="mt-6 px-1" />
        <footer className="mt-4 border-t border-border pt-4">
          <details className="text-[10px] text-muted-foreground/75">
            <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
              隱私權聲明
            </summary>
            <p className="mt-2 leading-relaxed pl-1">{PRIVACY_STATEMENT}</p>
          </details>
        </footer>
      </section>
    );
  }

  const {
    waterfallSteps,
    totalSpending,
    totalGrossCashback,
    totalForeignFee,
    totalNetCashback,
    cardBreakdown,
    hasKumamonBonus,
    hasDbsEcoBonus,
    savingsBreakdown,
  } = result;
  const capWarnings = cardBreakdown.filter((c) => c.capReached);
  const savingsRate = totalSpending > 0 ? ((totalNetCashback / totalSpending) * 100).toFixed(2) : "0.00";

  const url = typeof window !== "undefined" ? window.location.href : "https://card-calc.vercel.app";

  // Get the top recommended card (first in breakdown) and its perks
  const topCard = cardBreakdown[0];
  const topCardData = topCard ? CREDIT_CARDS.find((c) => c.id === topCard.cardId) : null;
  const topCardPerks = topCardData?.perks;

  const destinationTag = destination === "日本" ? "日本 🇯🇵" : "韓國 🇰🇷";

  const categoryBuckets = [
    {
      key: "flight",
      label: "✈️ 機票",
      chartColor: "#00b4ff",
      icon: Plane,
    },
    {
      key: "hotel",
      label: "🏨 住宿",
      chartColor: "#c026d3",
      icon: Hotel,
    },
    {
      key: "rental",
      label: "🚉 交通",
      chartColor: "#00ffa3",
      icon: Train,
    },
    {
      key: "local",
      label: "🛍️ 購物/餐飲",
      chartColor: "#ff6b35",
      icon: ShoppingBag,
    },
  ] as const;

  const spendingByCategory = categoryBuckets.map((bucket) => {
    const amount = waterfallSteps
      .filter((s) => s.category === bucket.key)
      .reduce((sum, s) => sum + s.amount, 0);
    return {
      ...bucket,
      amount,
      ratio: totalSpending > 0 ? amount / totalSpending : 0,
    };
  });
  const donutData = spendingByCategory
    .filter((x) => x.amount > 0)
    .map((x) => ({ name: x.label, value: x.amount, color: x.chartColor }));

  const shareTopCards = [...cardBreakdown]
    .sort((a, b) => b.netCashback - a.netCashback)
    .slice(0, 2);
  const savingsValue = totalNetCashback > 0 ? totalNetCashback : 0;
  const savingsTitle =
    Number(savingsRate) > 5
      ? "日本精省大師 🏆"
      : Number(savingsRate) >= 3
        ? "專業旅遊玩家 ✨"
        : "旅遊理性消費家";
  const savingsRamenBowls = Math.max(1, Math.floor(savingsValue / 300));
  const savingsDisneyPercent = Math.round((savingsValue / 3000) * 100);
  const medalGradient =
    Number(savingsRate) > 5
      ? "from-amber-300 via-yellow-200 to-amber-500"
      : Number(savingsRate) >= 3
        ? "from-violet-400 via-fuchsia-300 to-cyan-300"
        : "from-slate-300 via-zinc-400 to-orange-400";
  const cardSpendMap = new Map(cardBreakdown.map((c) => [c.cardId, c.spending]));
  type RegistrationTask = { cardId: string; cardName: string; url: string; note: string; bonus?: number };
  const registrationTasks = cardBreakdown
    .map<RegistrationTask | null>((cb) => {
      const card = CREDIT_CARDS.find((c) => c.id === cb.cardId);
      if (!card?.registrationUrl) return null;
      const isCube = cb.cardId === "cathay-cube";
      if (!card.registrationBonus && !isCube) return null;
      const spend = cardSpendMap.get(cb.cardId) ?? 0;
      const bonus = card.registrationBonus
        ? card.registrationBonus.type === "percent"
          ? Math.round((spend * card.registrationBonus.value) / 100)
          : Math.round(card.registrationBonus.value)
        : undefined;
      return {
        cardId: cb.cardId,
        cardName: cb.cardName,
        url: isCube ? CUBE_COUPON_URL : card.registrationUrl,
        note: isCube
          ? "日本賞指定通路需先領券；未領券僅套用一般回饋"
          : (card.registrationBonus?.note ?? "登錄活動"),
        ...(bonus != null ? { bonus } : {}),
      };
    })
    .filter((x): x is RegistrationTask => x !== null);
  const registrationExtraSaving = registrationTasks.reduce((sum, t) => sum + (t.bonus ?? 0), 0);
  const cardStrategyGroups = buildCardStrategyGroups(waterfallSteps);
  const shoppingStrategyLines = buildShoppingStrategySummary(waterfallSteps);

  const applyCardRecommendations = useMemo(() => {
    if (!recommendationContext || totalSpending <= 0) return [];
    const enrolledSet = new Set(recommendationContext.enrolledCards);
    const currentNet = Math.round(totalNetCashback);
    const selectedIds = recommendationContext.selectedCardIds;

    const rows = APPLY_RECOMMENDATION_CARD_IDS.map((id) => {
      const card = CREDIT_CARDS.find((c) => c.id === id);
      if (!card) return null;
      const applyUrl = CARD_APPLY_URLS[id];
      if (!applyUrl) return null;

      const solo = calculateOptimalCombination(
        recommendationContext.mergedSpending,
        [card],
        enrolledSet,
        recommendationContext.patternSelections,
        recommendationContext.selectedBrands,
        recommendationContext.holderCounts,
        recommendationContext.isDbsEcoNewUser,
        recommendationContext.kumamonWalletPaypayExcluded,
        recommendationContext.isKumamonFlightJpy,
        recommendationContext.dateRange,
        recommendationContext.sinopacLevel,
        {
          isSinopacNewUser: recommendationContext.isSinopacNewUser,
          isUnionJingheNewUser: recommendationContext.isUnionJingheNewUser,
        },
        recommendationContext.partySize
      );
      const tripSaving = Math.round(solo?.totalNetCashback ?? 0);

      const poolIds = new Set(selectedIds);
      poolIds.add(id);
      const poolCards = CREDIT_CARDS.filter((c) => poolIds.has(c.id));
      const withCardOpt = calculateOptimalCombination(
        recommendationContext.mergedSpending,
        poolCards,
        enrolledSet,
        recommendationContext.patternSelections,
        recommendationContext.selectedBrands,
        recommendationContext.holderCounts,
        recommendationContext.isDbsEcoNewUser,
        recommendationContext.kumamonWalletPaypayExcluded,
        recommendationContext.isKumamonFlightJpy,
        recommendationContext.dateRange,
        recommendationContext.sinopacLevel,
        {
          isSinopacNewUser: recommendationContext.isSinopacNewUser,
          isUnionJingheNewUser: recommendationContext.isUnionJingheNewUser,
        },
        recommendationContext.partySize
      );
      /** 加入卡包後可再增加的淨回饋（排序主鍵） */
      const potentialSavings = Math.max(0, Math.round(withCardOpt?.totalNetCashback ?? 0) - currentNet);

      const primarySaving =
        withCardOpt && potentialSavings > 0
          ? findPrimaryMarginalSaving(
              waterfallSteps,
              withCardOpt.waterfallSteps,
              recommendationContext.partySize,
              savingsBreakdown,
              withCardOpt.savingsBreakdown
            )
          : null;

      return {
        cardId: id,
        cardName: card.name,
        shortName: card.shortName,
        highlight: CARD_CORE_HIGHLIGHT[id] ?? card.notes ?? "",
        tripSaving,
        potentialSavings,
        applyUrl,
        primarySaving,
      };
    }).filter((x): x is NonNullable<typeof x> => x != null);

    rows.sort((a, b) => {
      const byPotential = b.potentialSavings - a.potentialSavings;
      return byPotential !== 0 ? byPotential : b.tripSaving - a.tripSaving;
    });
    return rows.slice(0, 3);
  }, [
    recommendationContext,
    totalSpending,
    totalNetCashback,
    waterfallSteps,
    savingsBreakdown,
  ]);

  const handleCopy = async () => {
    const tripPhrase = destination === "日本" ? "日本行" : "韓國行";
    const savingsAmountLabel = formatTWD(savingsValue);
    const comboBest =
      shareTopCards.map((c) => c.cardShortName).join(" + ") ||
      cardBreakdown.map((c) => c.cardShortName).join(" + ") ||
      "推薦組合";
    const text = `日幣 0.20 算什麼？我這趟${tripPhrase}用 #日本刷卡計算機 直接賺回 ${savingsRamenBowls} 碗拉麵！🍜 省錢總額 ${savingsAmountLabel}，最推 ${comboBest}！大家都該去算一下：${url}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silently fail
    }
  };

  const handleCopyStrategy = async () => {
    const flightCard = waterfallSteps.find((s) => s.category === "flight")?.cardShortName ?? (shareTopCards[0]?.cardShortName ?? "推薦卡A");
    const localCard = waterfallSteps.find((s) => s.category === "local")?.cardShortName ?? (shareTopCards[1]?.cardShortName ?? shareTopCards[0]?.cardShortName ?? "推薦卡B");
    const savings = formatTWD(totalNetCashback > 0 ? totalNetCashback : 0).replace("NT$", "").trim();
    const lines = `這趟${destination}行我用 #日本刷卡計算機 算完，預計能省下 NT$ ${savings}！💰 機票用 ${flightCard}、藥妝用 ${localCard} 拿 8.5% 最划算！推薦大家出國前先算一下：${url}`;

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedStrategy(true);
      setTimeout(() => setCopiedStrategy(false), 2500);
    } catch {
      // silently fail
    }
  };

  const handleDownloadShareCard = async () => {
    if (!shareCardRef.current) return;
    try {
      setDownloading(true);
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: "#0f172a",
        scale: 2,
        useCORS: true,
      });
      const image = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.href = image;
      link.download = `share-card-${new Date().toISOString().slice(0, 10)}.jpg`;
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section aria-label="計算結果">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Step {stepNumber} — 最優刷卡組合結果
        </h2>
      </div>

      {/* Summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div className="grid grid-cols-3 gap-2 flex-1">
        <StatCard
          label="總消費"
          value={formatTWD(totalSpending)}
          sub="NTD 計算基礎"
        />
        <StatCard
          label="海外手續費"
          value={`-${formatTWD(totalForeignFee)}`}
          sub="1.5% 已扣除"
        />
        <StatCard
          label="淨省下"
          value={formatTWD(totalNetCashback > 0 ? totalNetCashback : 0)}
          sub={`回饋率 ${savingsRate}%`}
          highlight
        />
        </div>
        <DataRecencyBlock className="sm:max-w-[200px] sm:text-right sm:pt-1 shrink-0" />
      </div>
      {registrationExtraSaving > 0 && (
        <p className="mb-3 text-xs font-medium text-emerald-600">
          若完成全部登錄，預計可再多省 {formatTWD(registrationExtraSaving)}！
        </p>
      )}

      {/* Viral share card */}
      <div
        id="share-card"
        ref={shareCardRef}
        className="mb-4 rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900 via-zinc-900 to-indigo-950 text-white shadow-[0_20px_60px_rgba(2,6,23,0.45)] overflow-hidden backdrop-blur-sm"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">{destinationTag}</span>
            <span className="text-[11px] text-white/70">{partySize} 人同行</span>
          </div>

          {destination === "日本" && (
            <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-300/90 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]">
              日幣匯率 0.20x 時代的精省奇蹟 🇯🇵
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-center">
            <p className="text-[11px] text-amber-100/80">這趟{destination}行，你預計省下</p>
            <p className="mt-2 text-[11px] leading-relaxed text-amber-50/95">
              在旅遊已經這麼便宜的情況下，你竟然還憑實力額外摳出這些錢！
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-amber-200 sm:text-4xl">
              {formatTWD(savingsValue)}！
            </p>
            {savingsValue >= 10000 && (
              <p className="mt-1 text-[11px] text-amber-100/90">
                ( 恭喜！你省下了一張廉航機票 ✈️ )
              </p>
            )}
            <p className="mt-1 text-[11px] text-amber-100/90">
              這筆錢夠你多吃 {savingsRamenBowls} 碗一蘭拉麵！🍜
            </p>
            <p className="mt-0.5 text-[11px] text-amber-100/80">
              省下了 {savingsDisneyPercent}% 的東京迪士尼門票預算 🎟️
            </p>
          </div>

          {/* 最神組合卡片：頭銜標籤在上、標題與卡名；置於總省下金額下方、消費熱力圖上方 */}
          <div
            className={cn(
              "mt-5 rounded-2xl border-2 p-4 sm:p-5",
              "bg-gradient-to-r from-indigo-950/50 to-purple-900/30",
              "border-amber-200/35 border-t-amber-100/25",
              "shadow-[0_0_0_1px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.1),0_12px_40px_rgba(49,46,129,0.35)]"
            )}
          >
            <p
              className={cn(
                "mb-2 inline-flex items-center rounded-full border border-amber-300/45 px-3 py-1 text-xs font-bold text-white",
                "bg-gradient-to-r bg-[length:200%_200%]",
                medalGradient,
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_3px_16px_rgba(0,0,0,0.22)]"
              )}
              style={{
                animation: "medal-shimmer 3.5s ease-in-out infinite",
              }}
            >
              {savingsTitle}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
              最神組合卡片
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
              {shareTopCards.length > 0 ? (
                shareTopCards.map((c, i) => (
                  <React.Fragment key={c.cardId}>
                    {i > 0 && (
                      <span className="text-xl font-extrabold text-amber-300/90 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]">
                        +
                      </span>
                    )}
                    <span className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-2xl">
                      <CreditCard className="h-7 w-7 shrink-0 text-amber-200 sm:h-8 sm:w-8 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
                      <span className="bg-gradient-to-r from-amber-100 via-white to-amber-50 bg-clip-text text-transparent">
                        {c.cardShortName}
                      </span>
                    </span>
                  </React.Fragment>
                ))
              ) : (
                <span className="text-xl font-extrabold text-white/50 sm:text-2xl">尚無推薦卡片</span>
              )}
            </div>
          </div>

          <p className="mt-4 text-[10px] font-medium tracking-wide text-white/50">消費熱力圖</p>
          <div className="mt-2 rounded-2xl border border-white/8 bg-white/[0.03] p-2.5">
            <div className="mx-auto h-52 w-full max-w-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="rgba(15,23,42,0.65)"
                    strokeWidth={2}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatTWD(Number(value))}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      border: "1px solid #6366f1",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.5)",
                    }}
                    itemStyle={{ color: "#ffffff" }}
                    labelStyle={{ color: "#ffffff", fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {donutData.map((item) => (
                <div key={item.name} className="rounded-lg border border-white/15 bg-black/25 px-2.5 py-2.5">
                  <p className="flex items-start gap-2 text-left text-[11px] font-medium leading-snug text-white/90">
                    <span
                      className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                      style={{ backgroundColor: item.color, color: item.color }}
                    />
                    <span className="min-w-0 flex-1">{item.name}</span>
                  </p>
                  <p className="mt-1.5 text-right text-sm font-bold tabular-nums tracking-tight text-white">
                    {formatTWD(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-2 text-center text-[9px] text-white/55 tracking-wide">
          Powered by 日本旅遊刷卡計算機
        </div>
      </div>

      {shoppingStrategyLines.length > 0 && (
        <div className="mb-3 overflow-hidden rounded-xl border border-amber-500/20 bg-slate-950/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md dark:bg-white/5">
          <div className="flex items-center gap-2 border-b border-amber-500/20 bg-white/[0.06] px-4 py-3 dark:bg-white/[0.04]">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-widest text-white">
              購物省錢攻略
            </p>
          </div>
          <div className="space-y-2 px-4 py-3">
            {shoppingStrategyLines.map((line, idx) => (
              <p key={idx} className="text-xs font-medium leading-relaxed text-amber-300">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Card grouped strategy list */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">刷卡攻略（按卡片）</p>
          <span className="text-[10px] text-muted-foreground">{cardStrategyGroups.length} 張卡片策略</span>
        </div>
        {cardStrategyGroups.map((group) => {
          const shouldShowCardIndex = (holderCounts[group.cardId] ?? 1) > 1;
          const cardIndex = group.holderIndex + 1;
          const displayCardTitle = shouldShowCardIndex
            ? `💳 ${group.cardName} (${cardIndex})`
            : `💳 ${group.cardName}`;

          return (
            <div
              key={group.key}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_8px_24px_rgba(15,23,42,0.28)]"
            >
              <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                <p className="text-sm font-bold text-zinc-100">
                  {displayCardTitle}
                </p>
                <p className="mt-1 text-[9px] text-zinc-400">
                  共 {group.steps.length} 筆消費項目
                </p>
                {group.actionNotes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="刷卡前操作提醒">
                    {group.actionNotes.map((note) => (
                      <span
                        key={note}
                        className="inline-flex max-w-full items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-snug text-amber-700 dark:text-amber-400"
                      >
                        {prefixActionNoteLabel(note)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="divide-y divide-border/70">
                {group.steps.map((step) => {
                  const disclaimer = strategyDisclaimerPrefix(step);
                  const icRankTag = transportTopupRankTag(step);
                  const needsApplePayReminder =
                    IC_TOPUP_IDS.has(step.brandId ?? "") &&
                    (step.cardId === "cathay-cube" || step.cardId === "fubon-j");
                  return (
                    <div key={step.stepIndex} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {disclaimer && (
                              <span className="inline-flex rounded border border-amber-600/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-200">
                                {disclaimer}
                              </span>
                            )}
                            <span className="text-xs font-medium text-zinc-100 leading-snug">
                              {formatStrategySourceLine(step)}
                            </span>
                            {icRankTag && (
                              <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-700 dark:text-cyan-200">
                                {icRankTag}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] font-mono text-zinc-300">
                            消費金額 {formatTWD(step.amount)} / 預計淨回饋{" "}
                            {step.netCashback > 0 ? `+${formatTWD(step.netCashback)}` : formatTWD(step.netCashback)}
                          </p>
                          {needsApplePayReminder && (
                            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">需開啟 Apple Pay 儲值</p>
                          )}
                          {step.specialNote && (
                            <div className="mt-1 flex items-center gap-1">
                              <Info className="h-2.5 w-2.5 text-muted-foreground/60" />
                              <p className={cn("text-[10px]", step.needsHolderSwap ? "font-medium text-amber-400" : "text-zinc-400")}>
                                {step.specialNote}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-3">
                <p className="text-xs font-semibold text-zinc-100">
                  本張卡合計刷卡金額：{formatTWD(group.totalAmount)} / 預計總回饋：
                  <span className={cn("ml-1 font-mono", group.totalNet > 0 ? "text-emerald-300" : "text-zinc-400")}>
                    {group.totalNet > 0 ? `+${formatTWD(group.totalNet)}` : formatTWD(group.totalNet)}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Split Suggestion - show when caps reached */}
      {capWarnings.length > 0 && (() => {
        const multiHolderCaps = capWarnings.filter((cw) => (holderCounts[cw.cardId] ?? 1) > 1);

        // Prefer showing a concrete split plan for one card (usually the bonus-capped one).
        const main = multiHolderCaps[0];
        const holders = main ? (holderCounts[main.cardId] ?? 1) : 0;
        const perHolderCapSpending = main?.capSpendingPerHolder ?? 0;
        const perPersonSuggested = main
          ? Math.min(perHolderCapSpending > 0 ? perHolderCapSpending : main.spending, Math.ceil(main.spending / holders))
          : 0;

        const splitInstructions: { card: string; amount: number; person: number }[] = [];
        if (main && holders > 1 && perPersonSuggested > 0) {
          for (let i = 1; i <= holders; i++) {
            const amt = Math.min(perPersonSuggested, Math.max(0, main.spending - perPersonSuggested * (i - 1)));
            if (amt > 0) splitInstructions.push({ card: main.cardShortName, amount: amt, person: i });
          }
        }

        const withinCapacity = splitInstructions.length > 0;

        return (
          <div className="rounded-xl border border-foreground/20 bg-foreground/5 overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-foreground" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">{"拆單攻略建議"}</p>
            </div>
            <div className="px-4 py-3">
              {withinCapacity ? (
                <>
                  <p className="text-sm text-foreground leading-relaxed mb-2">
                    {"透過分開刷卡，此筆消費可全額享有最高回饋！"}
                  </p>
                  <div className="space-y-1.5 mb-2">
                    {splitInstructions.map((inst, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground font-mono">
                        {`${i + 1}. 第${inst.person}人持${inst.card}刷 ${formatTWD(inst.amount)}`}
                      </p>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
                    {"餘額由次優卡支付"}
                  </p>
                </>
              ) : partySize > 1 ? (
                <>
                  <p className="text-sm text-foreground leading-relaxed">
                    {"偵測到多人旅遊！建議同行者各持一張 "}
                    <span className="font-semibold">{capWarnings[0].cardName}</span>
                    {"，分開支付可額外多賺約 "}
                    <span className="font-bold font-mono text-foreground">
                      {formatTWD(capWarnings.reduce((sum, c) => sum + (c.netCashback * 0.3), 0))}
                    </span>
                    {" 回饋。"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    {"範例：星展eco每人加碼上限600點（約NT$15,000）、熊本熊卡每人上限NT$500（約NT$8,333）"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {"已達回饋上限，建議超出部分使用次優卡。"}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Cap reached warnings */}
      {capWarnings.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-3">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">回饋上限提醒</p>
          </div>
          <div className="divide-y divide-border">
            {capWarnings.map((cb) => (
              <div key={cb.cardId} className="flex items-center gap-3 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-semibold">{cb.cardName}</span> 已達回饋上限，建議超出部分換卡刷。
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card usage summary */}
      {cardBreakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">使用卡片摘要</p>
          </div>
          <div className="divide-y divide-border">
            {cardBreakdown.map((cb) => (
              <div key={cb.cardId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{cb.cardName}</p>
                    {cb.capReached && <AlertTriangle className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{cb.categories.join(" + ")}</p>
                  {cb.validityWarning && (
                    <p className="text-[10px] text-amber-600 mt-0.5">{cb.validityWarning}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold font-mono text-foreground">
                    +{formatTWD(cb.netCashback > 0 ? cb.netCashback : 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">淨回饋</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perks Summary Panel */}
      {topCardData && topCardPerks && (
        <div className="rounded-xl border border-border bg-secondary/50 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              卡友權益摘要
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              推薦首選：{topCardData.shortName}
            </p>
          </div>
          {/* Horizontal scroll on mobile, grid on larger screens */}
          <div className="p-3 overflow-x-auto">
            <div className="flex gap-2 sm:grid sm:grid-cols-4 min-w-max sm:min-w-0">
              {/* Shuttle */}
              {topCardPerks.shuttle && (
                <div className="flex-shrink-0 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 min-w-[120px] sm:min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">機場接送</p>
                    <p className="text-sm font-bold font-mono text-foreground">{topCardPerks.shuttle} 次/年</p>
                  </div>
                </div>
              )}
              {/* Lounge */}
              {topCardPerks.lounge && (
                <div className="flex-shrink-0 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 min-w-[120px] sm:min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Sofa className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">貴賓室</p>
                    <p className="text-sm font-bold font-mono text-foreground">{topCardPerks.lounge} 次/年</p>
                  </div>
                </div>
              )}
              {/* Insurance */}
              {topCardPerks.insurance && (
                <div className="flex-shrink-0 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 min-w-[120px] sm:min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">旅平險</p>
                    <p className="text-sm font-bold font-mono text-foreground">{topCardPerks.insurance} 萬</p>
                  </div>
                </div>
              )}
              {/* Roadside */}
              {topCardPerks.roadside && (
                <div className="flex-shrink-0 flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 min-w-[120px] sm:min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">道路救援</p>
                    <p className="text-sm font-bold font-mono text-foreground">{topCardPerks.roadside} 次/年</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Disclaimer */}
          <div className="px-4 py-2.5 border-t border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              *提醒：上述權益通常需刷卡付機票或 80% 團費後生效，詳情請點擊官網連結確認。
            </p>
          </div>
        </div>
      )}

      {/* DBS eco disclaimer */}
      {hasDbsEcoBonus && (
        <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 mb-4">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            *星展eco加碼說明：1%基礎回饋無上限；4%加碼每期帳單上限 600 點，約於消費 NT$15,000 達上限。SUICA/PASMO/ICOCA 儲值僅享 1% 基礎回饋。點數回饋有效期 18 個月。
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Threads war report */}
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-all duration-200",
            copied
              ? "border-foreground/30 bg-foreground/10 text-foreground"
              : "border-foreground bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
          )}
          aria-label="複製 Threads 戰報"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.5} />
              已複製！
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              複製 Threads 戰報
            </>
          )}
        </button>

        {/* Strategy guide */}
        <button
          type="button"
          onClick={handleCopyStrategy}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-all duration-200",
            copiedStrategy
              ? "border-foreground/30 bg-foreground/10 text-foreground"
              : "border-border bg-secondary text-foreground hover:border-foreground/50 hover:bg-accent active:scale-[0.98]"
          )}
          aria-label="一鍵複製攻略文案"
        >
          {copiedStrategy ? (
            <>
              <Check className="h-4 w-4" strokeWidth={2.5} />
              攻略已複製！
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              複製攻略文案
            </>
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={handleDownloadShareCard}
        disabled={downloading}
        className={cn(
          "mt-2 w-full flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-all duration-200",
          downloading
            ? "border-foreground/30 bg-foreground/10 text-foreground"
            : "border-border bg-card text-foreground hover:border-foreground/50 hover:bg-accent active:scale-[0.98]"
        )}
      >
        <Download className="h-4 w-4" />
        {downloading ? "產生戰果圖中..." : "下載戰果圖"}
      </button>

      {registrationTasks.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/40 dark:border-white/10 dark:bg-white/5">
          <div className="border-b border-border px-4 py-4 dark:border-white/10 sm:px-6 sm:py-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">
              💡 登錄任務：別忘了領額外回饋
            </p>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-4">
            {registrationTasks.map((task) => (
              <div
                key={task.cardId}
                className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/60 p-4 dark:border-white/15 dark:bg-black/20"
              >
                <div className="flex min-w-0 flex-row items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 break-words text-left text-xs font-medium text-foreground dark:text-white">
                    {task.cardName}
                  </p>
                  <a
                    href={task.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackConversion(task.cardName, "register_task")}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background/90 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-muted dark:border-white/20 dark:bg-white/10 dark:text-amber-200 dark:hover:bg-white/15 dark:hover:border-white/30"
                  >
                    點我登錄
                  </a>
                </div>
                <p className="block w-full text-[11px] leading-relaxed text-muted-foreground dark:text-white/65">
                  {task.note}
                  {task.bonus != null ? `，可再省 ${formatTWD(task.bonus)}` : ""}
                </p>
              </div>
            ))}
            <RegistrationFooterLegalBlock />
          </div>
        </div>
      )}

      {applyCardRecommendations.length > 0 && recommendationContext && (
        <div className="mt-8 rounded-2xl border border-violet-500/30 bg-gradient-to-b from-violet-500/[0.07] to-background overflow-hidden">
          <div className="border-b border-violet-500/20 bg-violet-500/10 px-4 py-3.5 sm:px-5">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
              最佳辦卡建議（推薦與辦卡）
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
              依目前消費與通路試算：左欄為「僅使用該卡」之預估淨回饋；若將該卡加入卡包後整體試算可再提升，將顯示於按鈕文案。排序依「加入卡包後可再增加之淨回饋」由高到低（最多 3 張）。
            </p>
          </div>
          <ul className="list-none space-y-3 border-t border-violet-500/15 bg-black/25 p-3 sm:p-4 dark:bg-black/45">
            {applyCardRecommendations.map((row) => {
              const ctaAmount = row.potentialSavings > 0 ? row.potentialSavings : row.tripSaving;
              const btnClass =
                CARD_APPLY_BUTTON_CLASS[row.cardId] ??
                "bg-gradient-to-r from-violet-600 to-indigo-700 hover:opacity-95 shadow-md shadow-violet-900/25";
              return (
                <li
                  key={row.cardId}
                  className="rounded-xl border border-violet-500/20 bg-zinc-950/80 p-4 shadow-inner shadow-black/30 dark:border-white/10 dark:bg-zinc-950/90"
                >
                  <p className="text-sm font-semibold text-foreground">{row.cardName}</p>
                  {row.primarySaving != null && (
                    <p className="mt-2 text-[12px] font-semibold leading-snug text-emerald-400">
                      💡 主要省在：{row.primarySaving.label}，可多拿 {formatTWD(row.primarySaving.delta)} 回饋
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{row.highlight}</p>
                  <p className="mt-3 text-lg font-bold font-mono tracking-tight text-violet-700 dark:text-violet-300">
                    這趟旅程預計省下 {formatTWD(row.tripSaving)}
                  </p>
                  {row.potentialSavings > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-400">
                      加入卡包後，與目前方案相較約可再增加 {formatTWD(row.potentialSavings)} 淨回饋
                    </p>
                  )}
                  <a
                    href={row.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackConversion(row.cardName, "apply_card")}
                    className={cn(
                      "mt-3 flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-sm font-bold text-white transition-all active:scale-[0.99]",
                      btnClass
                    )}
                  >
                    立即辦卡，再省 {formatTWD(ctaAmount)}
                  </a>
                  <ApplyCardLegalBlock />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export {
  DataRecencyBlock,
  PRIVACY_STATEMENT,
  RIGHTS_UPDATE_LABEL,
  DATA_SOURCE_NOTE,
  LEGAL_CREDIT_ALERT,
  LEGAL_CYCLE_RATE_LINE,
};
