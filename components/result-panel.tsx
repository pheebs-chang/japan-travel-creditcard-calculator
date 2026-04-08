"use client";

import React, { useRef, useState } from "react";
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
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CREDIT_CARDS } from "@/lib/card-data";
import { CalculationResult, formatTWD, type WaterfallStep } from "@/lib/calculator";
import { cn } from "@/lib/utils";

interface ResultPanelProps {
  result: CalculationResult | null;
  destination: "日本" | "韓國";
  stepNumber?: number;
  partySize?: number;
  holderCounts?: Record<string, number>;
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
  const emoji = strategyEmoji(step.subCategory ?? sub, detail);
  if (step.category === "hotel" && step.expenseLabel && !step.detailLabel) {
    return `${emoji} 訂購住宿（${step.expenseLabel}）`;
  }
  if (detail) return `${emoji} ${sub}（${detail}）`;
  return `${emoji} ${sub}`;
}

function formatStrategyCardLine(step: WaterfallStep, partySize: number): string {
  if (step.travelerIndex !== undefined && partySize > 1) {
    return `👤 旅客 ${step.travelerIndex + 1} 的 ${step.cardShortName}卡`;
  }
  return step.cardName;
}

/** 是否需在「上一筆 → 本筆」之間顯示換手／溢出提示 */
function shouldShowSpillBanner(prev: WaterfallStep, curr: WaterfallStep): boolean {
  if (prev.isDbsEcoBonus && curr.isDbsEcoBaseOnly && prev.cardId === curr.cardId) return true;
  if (prev.isKumamonBonus && !curr.isKumamonBonus && prev.cardId === curr.cardId) return true;
  if (!prev.isCapReached) return false;
  return (
    prev.cardId !== curr.cardId ||
    (prev.travelerIndex ?? 0) !== (curr.travelerIndex ?? 0) ||
    !!curr.isOverflow
  );
}

/** 動態換手提示（旅客編號為 1 起算） */
function getSpillHandoffBannerText(prev: WaterfallStep, curr: WaterfallStep, partySize: number): string | null {
  if (!shouldShowSpillBanner(prev, curr)) return null;

  if (partySize <= 1) {
    if (prev.isDbsEcoBonus && curr.isDbsEcoBaseOnly && prev.cardId === curr.cardId) {
      return `🛑 ${prev.cardShortName}卡 加碼額度已滿，剩餘金額改以基礎回饋計算`;
    }
    if (prev.isKumamonBonus && !curr.isKumamonBonus && prev.cardId === curr.cardId) {
      return `🛑 ${prev.cardShortName}卡 加碼額度已滿，剩餘金額改以基礎回饋計算`;
    }
    if (prev.cardId !== curr.cardId) {
      return `🛑 ${prev.cardShortName}卡 額度已滿，剩餘金額請改刷 ${curr.cardShortName}卡`;
    }
    if (curr.isOverflow && prev.cardId === curr.cardId) {
      return `🛑 ${prev.cardShortName}卡 額度已滿，剩餘金額改以超額回饋計算`;
    }
    return "🛑 此卡已達加碼上限";
  }

  const p1 = (prev.travelerIndex ?? 0) + 1;
  const p2 = (curr.travelerIndex ?? 0) + 1;
  const samePerson = (prev.travelerIndex ?? 0) === (curr.travelerIndex ?? 0);

  if (prev.isDbsEcoBonus && curr.isDbsEcoBaseOnly && prev.cardId === curr.cardId) {
    return `🛑 旅客 ${p1} 的 ${prev.cardShortName}卡 加碼額度已滿，剩餘金額改以基礎回饋計算`;
  }
  if (prev.isKumamonBonus && !curr.isKumamonBonus && prev.cardId === curr.cardId) {
    return `🛑 旅客 ${p1} 的 ${prev.cardShortName}卡 加碼額度已滿，剩餘金額改以基礎回饋計算`;
  }

  if (samePerson && prev.cardId !== curr.cardId) {
    return `🛑 旅客 ${p1} 的 ${prev.cardShortName}卡 額度已滿，剩餘金額請改刷 ${curr.cardShortName}卡`;
  }
  if (!samePerson) {
    return `🛑 旅客 ${p1} 的額度已滿，剩餘金額請交由 👤 旅客 ${p2} 繼續刷卡`;
  }
  if (prev.cardId === curr.cardId && curr.isOverflow) {
    return `🛑 旅客 ${p1} 的 ${prev.cardShortName}卡 額度已滿，剩餘金額改以超額回饋計算`;
  }
  return "🛑 此卡已達加碼上限";
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

export function ResultPanel({ result, destination, stepNumber = 4, partySize = 1, holderCounts = {} }: ResultPanelProps) {
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
      </section>
    );
  }

  const { waterfallSteps, totalSpending, totalGrossCashback, totalForeignFee, totalNetCashback, cardBreakdown, hasKumamonBonus, hasDbsEcoBonus } = result;
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
  const registrationTasks = cardBreakdown
    .map((cb) => {
      const card = CREDIT_CARDS.find((c) => c.id === cb.cardId);
      if (!card?.registrationBonus || !card.registrationUrl) return null;
      const spend = cardSpendMap.get(cb.cardId) ?? 0;
      const bonus = card.registrationBonus.type === "percent"
        ? Math.round((spend * card.registrationBonus.value) / 100)
        : Math.round(card.registrationBonus.value);
      return {
        cardId: cb.cardId,
        cardName: cb.cardName,
        url: card.registrationUrl,
        note: card.registrationBonus.note ?? "登錄活動",
        bonus,
      };
    })
    .filter((x): x is { cardId: string; cardName: string; url: string; note: string; bonus: number } => !!x);
  const registrationExtraSaving = registrationTasks.reduce((sum, t) => sum + t.bonus, 0);

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
      <div className="grid grid-cols-3 gap-2 mb-4">
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

          {/* 最神組合卡片：置於總省下金額下方、消費熱力圖上方 */}
          <div
            className={cn(
              "mt-5 rounded-2xl border-2 p-4 sm:p-5",
              "bg-gradient-to-r from-indigo-950/50 to-purple-900/30",
              "border-amber-200/35 border-t-amber-100/25",
              "shadow-[0_0_0_1px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.1),0_12px_40px_rgba(49,46,129,0.35)]"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-200/90">
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
            <p
              className={cn(
                "mt-4 inline-flex items-center rounded-full border-2 border-amber-300/40 px-4 py-2 text-sm font-black text-white",
                "bg-gradient-to-r bg-[length:200%_200%]",
                medalGradient,
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_20px_rgba(0,0,0,0.25)]"
              )}
              style={{
                animation: "medal-shimmer 3.5s ease-in-out infinite",
              }}
            >
              {savingsTitle}
            </p>
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

      {/* Waterfall order list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden mb-3">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">刷卡攻略</p>
          <span className="text-[10px] text-muted-foreground">{waterfallSteps.length} 個步驟</span>
        </div>
        <div className="divide-y divide-border">
          {waterfallSteps.map((step, index) => {
            const disclaimer = strategyDisclaimerPrefix(step);
            return (
            <React.Fragment key={step.stepIndex}>
            <div
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                step.needsHolderSwap && "bg-amber-500/10 border-l-2 border-amber-500"
              )}
            >
              {/* Step number */}
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border bg-secondary mt-0.5">
                <span className="text-[10px] font-bold font-mono text-foreground">{step.stepIndex}</span>
              </div>

              <div className="flex-1 min-w-0">
                {/* Category → Card */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {disclaimer && (
                    <span className="inline-flex shrink-0 rounded border border-amber-600/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-200">
                      {disclaimer}
                    </span>
                  )}
                  <span className="text-xs font-medium text-foreground leading-snug">
                    {formatStrategySourceLine(step)}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground">
                    {formatStrategyCardLine(step, partySize)}
                  </span>
                  {step.isKumamonBonus && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground/10 border border-foreground/20 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                      <Star className="h-2.5 w-2.5" />
                      指定通路加碼
                    </span>
                  )}
                  {step.isDbsEcoBonus && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground/10 border border-foreground/20 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                      <Star className="h-2.5 w-2.5" />
                      實體5%
                    </span>
                  )}
                  {step.isDbsEcoBaseOnly && (
                    <span className="inline-flex items-center rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      僅1%
                    </span>
                  )}
                  {step.isOverflow && (
                    <span className="inline-flex items-center rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      超額
                    </span>
                  )}
                  {step.isCapReached && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-500 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 animate-pulse">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      達上限
                    </span>
                  )}
                  {!step.enrolled && (
                    <span className="inline-flex items-center rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                      未登錄
                    </span>
                  )}
                </div>
                {/* Amount detail */}
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  {formatTWD(step.amount)} × {step.cashbackRate}%
                  {step.foreignFee > 0 && ` - 手續費 ${formatTWD(step.foreignFee)}`}
                  {step.foreignFee === 0 && (step.cardId === "sinopac-doublebei") && (
                    <span className="text-muted-foreground/60"> （雙幣卡免手續費）</span>
                  )}
                  {step.isCapReached && step.capAmount != null && (
                    <span className="text-amber-700"> （加碼上限 600 點，約 NT$15,000）</span>
                  )}
                </p>
                {step.isCapReached && (
                  <p className="text-[10px] text-amber-700 mt-0.5 font-medium">本筆已刷滿 NT$ 15,000 限額</p>
                )}
                {step.baseCashback != null && (
                  <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                    1% 基礎回饋 {formatTWD(step.baseCashback)}
                    {step.bonusCashback != null ? ` + 4% 加碼回饋 ${formatTWD(step.bonusCashback)}` : ""}
                  </p>
                )}
                {/* Special note */}
                {step.specialNote && (
                  <div className="flex items-center gap-1 mt-1">
                    <Info className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <p className={cn("text-[10px]", step.needsHolderSwap ? "text-amber-700 font-medium" : "text-muted-foreground/70")}>{step.specialNote}</p>
                  </div>
                )}
              </div>

              {/* Net cashback */}
              <div className="text-right flex-shrink-0">
                <p className={cn("text-sm font-bold font-mono", step.netCashback > 0 ? "text-foreground" : "text-muted-foreground")}>
                  {step.netCashback > 0 ? `+${formatTWD(step.netCashback)}` : formatTWD(step.netCashback)}
                </p>
                <p className="text-[10px] text-muted-foreground">淨回饋</p>
              </div>
            </div>
          {index > 0 &&
            (() => {
              const prev = waterfallSteps[index - 1];
              const line = getSpillHandoffBannerText(prev, step, partySize);
              if (!line) return null;
              return (
                <div className="mx-4 -mt-1 mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-medium text-amber-700 leading-relaxed">
                  {line}
                </div>
              );
            })()}
          </React.Fragment>
            );
          })}
        </div>
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
              *提醒：上述權益通常需刷��機票或 80% 團費後生效，詳情請點擊官網連結確認。
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
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-200">
            <p className="text-sm font-semibold text-emerald-800">💡 登錄任務：別忘了領額外回饋</p>
          </div>
          <div className="divide-y divide-emerald-100">
            {registrationTasks.map((task) => (
              <div key={task.cardId} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{task.cardName}</p>
                  <p className="text-[11px] text-muted-foreground">{task.note}，可再省 {formatTWD(task.bonus)}</p>
                </div>
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  點我登錄
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
