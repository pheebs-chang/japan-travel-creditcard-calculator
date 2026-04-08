"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { MapPin, ChevronDown, Calculator, Users, Minus, Plus } from "lucide-react";
import { SpendingInputPanel } from "@/components/spending-input";
import { SpendingPatternPanel } from "@/components/spending-pattern";
import { CardSelector } from "@/components/card-selector";
import { ResultPanel } from "@/components/result-panel";
import { Switch } from "@/components/ui/switch";
import {
  SpendingInput,
  CalculationResult,
  calculateOptimalCombination,
  mergePatternAmounts,
  logCalculation,
  PatternSelection,
  totalAccommodationAmount,
  type PaymentChannel,
  type MergePatternPaymentOptions,
} from "@/lib/calculator";
import { CREDIT_CARDS } from "@/lib/card-data";
import { cn } from "@/lib/utils";

const DEFAULT_SPENDING: SpendingInput = {
  flight: 0,
  accommodationExpenses: [],
  rental: 0,
  local: 0,
  flightPaymentMethod: "online",
};

const DESTINATIONS = ["日本", "韓國"] as const;
type Destination = (typeof DESTINATIONS)[number];
type PageSearchParams = Record<string, string | string[] | undefined>;
type TravelDateRange = { from: string; to: string };

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-4">
      Step {number} — {title}
    </h2>
  );
}

export default function HomePage(props: {
  searchParams?: Promise<PageSearchParams>;
}) {
  const searchParams = props.searchParams ?? Promise.resolve({});
  const sp = React.use(searchParams);
  void sp;
  const [spending, setSpending] = useState<SpendingInput>(DEFAULT_SPENDING);
  const [patternAmounts, setPatternAmounts] = useState<Record<string, number>>({});
  const [selectedBrands, setSelectedBrands] = useState<Record<string, string>>({});
  const [selectedCards, setSelectedCards] = useState<string[]>(CREDIT_CARDS.map((c) => c.id));
  const [enrolledCards, setEnrolledCards] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>("日本");
  const [dateRange, setDateRange] = useState<TravelDateRange>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today, to: today };
  });
  const [destOpen, setDestOpen] = useState(false);
  const [partySize, setPartySize] = useState<number>(1);
  const [holderCounts, setHolderCounts] = useState<Record<string, number>>({});
  const [flightBrandId, setFlightBrandId] = useState<string | null>(null);
  const [isKumamonFlightJpy, setIsKumamonFlightJpy] = useState(false);
  const [isDbsEcoNewUser, setIsDbsEcoNewUser] = useState(false);
  const [kumamonWalletPaypayExcluded, setKumamonWalletPaypayExcluded] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [applePayByBrand, setApplePayByBrand] = useState<Record<string, boolean>>({});
  const [sinopacLevel, setSinopacLevel] = useState<1 | 2>(1);
  const [isUnionJingheNewUser, setIsUnionJingheNewUser] = useState(false);
  const [isSinopacNewUser, setIsSinopacNewUser] = useState(false);
  const [patternPaymentByKey, setPatternPaymentByKey] = useState<Record<string, PaymentChannel>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const expiryThreshold = new Date("2026-06-30T23:59:59");
    setShowExpirationWarning(now > expiryThreshold);
  }, []);

  // Merge Step 2 base amounts + Step 3 pattern amounts
  const paymentMergeOpts = useMemo((): MergePatternPaymentOptions => {
    const accommodationPaymentById: Record<string, PaymentChannel> = {};
    for (const e of spending.accommodationExpenses ?? []) {
      accommodationPaymentById[e.id] = e.paymentMethod ?? "online";
    }
    return {
      flightPaymentMethod: spending.flightPaymentMethod ?? "online",
      accommodationPaymentById,
      patternPaymentByKey,
    };
  }, [spending.accommodationExpenses, spending.flightPaymentMethod, patternPaymentByKey]);

  const { merged: mergedSpending, selections: patternSelections } = useMemo(
    () =>
      mergePatternAmounts(
        spending,
        patternAmounts,
        selectedBrands,
        flightBrandId,
        applePayByBrand,
        paymentMergeOpts
      ),
    [spending, patternAmounts, selectedBrands, flightBrandId, applePayByBrand, paymentMergeOpts]
  );

  const hasInput = useMemo(() => {
    const m = mergedSpending;
    return (
      totalAccommodationAmount(m) > 0 ||
      (m.flight ?? 0) > 0 ||
      (m.rental ?? 0) > 0 ||
      (m.local ?? 0) > 0
    );
  }, [mergedSpending]);

  const canCalculate = hasInput && selectedCards.length > 0;

  useEffect(() => {
    if (!canCalculate) {
      setResult(null);
      return;
    }
    const cards = CREDIT_CARDS.filter((c) => selectedCards.includes(c.id));
    const enrolledSet = new Set(enrolledCards);
    const calc = calculateOptimalCombination(
      mergedSpending,
      cards,
      enrolledSet,
      patternSelections,
      selectedBrands,
      holderCounts,
      isDbsEcoNewUser,
      kumamonWalletPaypayExcluded,
      isKumamonFlightJpy,
      dateRange,
      sinopacLevel,
      { isSinopacNewUser, isUnionJingheNewUser },
      partySize
    );
    setResult(calc);
  }, [
    canCalculate,
    mergedSpending,
    selectedCards,
    enrolledCards,
    patternSelections,
    selectedBrands,
    holderCounts,
    isDbsEcoNewUser,
    kumamonWalletPaypayExcluded,
    isKumamonFlightJpy,
    dateRange,
    sinopacLevel,
    isSinopacNewUser,
    isUnionJingheNewUser,
    partySize,
  ]);

  const handleCalculate = useCallback(() => {
    if (!canCalculate) return;
    const cards = CREDIT_CARDS.filter((c) => selectedCards.includes(c.id));
    const enrolledSet = new Set(enrolledCards);
    const calc = calculateOptimalCombination(
      mergedSpending,
      cards,
      enrolledSet,
      patternSelections,
      selectedBrands,
      holderCounts,
      isDbsEcoNewUser,
      kumamonWalletPaypayExcluded,
      isKumamonFlightJpy,
      dateRange,
      sinopacLevel,
      { isSinopacNewUser, isUnionJingheNewUser },
      partySize
    );
    setResult(calc);

    if (calc) {
      const isKkdayUsed = patternSelections.some((s) => s.isKkday && s.amount > 0);
      logCalculation({
        destination,
        spending: mergedSpending,
        patternAmounts,
        selectedCards,
        enrolledCards,
        selectedBrands,
        travelPartySize: partySize,
        holderCountsPerCard: holderCounts,
        is_kkday_used: isKkdayUsed,
        is_dbs_eco_new_user: isDbsEcoNewUser,
        result: calc,
      });
    }
  }, [
    canCalculate,
    mergedSpending,
    selectedCards,
    enrolledCards,
    destination,
    patternAmounts,
    patternSelections,
    selectedBrands,
    partySize,
    holderCounts,
    isDbsEcoNewUser,
    kumamonWalletPaypayExcluded,
    isKumamonFlightJpy,
    dateRange,
    sinopacLevel,
    isSinopacNewUser,
    isUnionJingheNewUser,
  ]);

  return (
    <div className="min-h-screen bg-background font-sans">
      {isMounted && showExpirationWarning && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5">
          <p className="mx-auto max-w-2xl text-center text-sm font-medium text-destructive leading-relaxed">
            ⚠️ 注意：部分信用卡權益可能已於 2026/06/30 到期，新版權益正在核實中，目前計算結果可能產生誤差。
          </p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-foreground" />
            <span className="font-semibold text-sm text-foreground tracking-tight">刷卡試算</span>
          </div>

          {/* Destination pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDestOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              aria-expanded={destOpen}
              aria-haspopup="listbox"
            >
              {destination === "日本" ? "🇯🇵" : "🇰🇷"} {destination}
              <ChevronDown className={cn("h-3 w-3 transition-transform", destOpen && "rotate-180")} />
            </button>

            {destOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-full mt-1.5 w-28 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-30"
              >
                {DESTINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="option"
                    aria-selected={destination === d}
                    onClick={() => {
                      setDestination(d);
                      setDestOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors",
                      destination === d
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {d === "日本" ? "🇯🇵" : "🇰🇷"} {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight text-balance leading-tight">
            日韓旅遊
            <br />
            最強刷卡組合計算機
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            選卡、填金額、按計算，自動產出 Waterfall 最優刷卡清單。
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">

          {/* Step 1 — Card selection + Party size */}
          <section aria-label="選擇信用卡">
            <StepHeading number={1} title="選擇手上的信用卡" />
            
            {/* Travel date range */}
            <div className="mb-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">預計旅遊日期</p>
                  <p className="text-xs text-muted-foreground">用於檢查卡片優惠是否涵蓋整段旅程</p>
                </div>
                <div className="relative z-10 grid grid-cols-2 gap-2 pointer-events-auto">
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      setDateRange((prev) => {
                        if (!from) return prev;
                        const nextTo = prev.to < from ? from : prev.to;
                        return { from, to: nextTo };
                      });
                    }}
                    className="relative z-10 min-h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    aria-label="預計旅遊開始日期"
                  />
                  <input
                    type="date"
                    value={dateRange.to}
                    min={dateRange.from}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDateRange((prev) => {
                        if (!raw) return prev;
                        return { ...prev, to: raw < prev.from ? prev.from : raw };
                      });
                    }}
                    className="relative z-10 min-h-9 w-full cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    aria-label="預計旅遊結束日期"
                  />
                </div>
              </div>
            </div>

            {/* Party size selector */}
            <div className="mb-5 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">旅遊人數</p>
                    <p className="text-xs text-muted-foreground">品牌消費將自動 x 人數</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPartySize((v) => Math.max(1, v - 1))}
                    disabled={partySize <= 1}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                      partySize > 1
                        ? "border-foreground/30 text-foreground hover:bg-foreground hover:text-background"
                        : "border-border text-muted-foreground/30 cursor-not-allowed"
                    )}
                    aria-label="減少人數"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-mono text-lg font-bold text-foreground">{partySize}</span>
                  <button
                    type="button"
                    onClick={() => setPartySize((v) => Math.min(8, v + 1))}
                    disabled={partySize >= 8}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                      partySize < 8
                        ? "border-foreground/30 text-foreground hover:bg-foreground hover:text-background"
                        : "border-border text-muted-foreground/30 cursor-not-allowed"
                    )}
                    aria-label="增加人數"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <CardSelector
              selected={selectedCards}
              enrolled={enrolledCards}
              holderCounts={holderCounts}
              partySize={partySize}
              sinopacDoublebeiLevel={sinopacLevel}
              onSinopacDoublebeiLevelChange={setSinopacLevel}
              isDbsEcoNewUser={isDbsEcoNewUser}
              onDbsEcoNewUserChange={setIsDbsEcoNewUser}
              isSinopacNewUser={isSinopacNewUser}
              onSinopacNewUserChange={setIsSinopacNewUser}
              isUnionJingheNewUser={isUnionJingheNewUser}
              onUnionJingheNewUserChange={setIsUnionJingheNewUser}
              onSelectedChange={setSelectedCards}
              onEnrolledChange={setEnrolledCards}
              onHolderCountsChange={setHolderCounts}
            />

            {/* Kumamon Wallet/PayPay exclusion */}
            {selectedCards.includes("esun-kumamon") && (
              <div className="mt-5 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">熊本熊指定通路使用玉山 Wallet/PayPay</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
                      勾選後熊本熊卡不享 6% 加碼，僅享 2.5% 基礎回饋。
                    </p>
                  </div>
                  <Switch
                    checked={kumamonWalletPaypayExcluded}
                    onCheckedChange={setKumamonWalletPaypayExcluded}
                    aria-label="玉山 Wallet/PayPay 排除熊本熊6%加碼"
                  />
                </div>
              </div>
            )}
          </section>

          <div className="h-px bg-border" role="separator" />

          {/* Step 2 — Unified spending planning */}
          <section aria-label="消費明細規劃">
            <StepHeading number={2} title="消費明細規劃" />
            <p className="mb-4 text-xs text-muted-foreground/70 leading-relaxed">
              點選各類別並輸入金額，系統將自動計算最佳刷卡組合。
            </p>
            <SpendingInputPanel
              spending={spending}
              partySize={partySize}
              onChange={setSpending}
              flightBrandId={flightBrandId}
              onFlightBrandIdChange={setFlightBrandId}
              isKumamonFlightJpy={isKumamonFlightJpy}
              onKumamonFlightJpyChange={setIsKumamonFlightJpy}
            />
            <SpendingPatternPanel 
              patternAmounts={patternAmounts} 
              selectedBrands={selectedBrands}
              partySize={partySize}
              applePayByBrand={applePayByBrand}
              onApplePayByBrandChange={(brandId, value) =>
                setApplePayByBrand((prev) => ({ ...prev, [brandId]: value }))
              }
              patternPaymentByKey={patternPaymentByKey}
              onPatternPaymentChange={(key, channel) =>
                setPatternPaymentByKey((prev) => ({ ...prev, [key]: channel }))
              }
              onChange={setPatternAmounts} 
              onBrandChange={setSelectedBrands}
            />
          </section>

          <div className="h-px bg-border" role="separator" />

          {/* Calculate button */}
          <button
            type="button"
            onClick={handleCalculate}
            disabled={!canCalculate}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 rounded-xl py-4 text-sm font-bold transition-all duration-200",
              canCalculate
                ? "bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98]"
                : "bg-secondary text-muted-foreground cursor-not-allowed"
            )}
            aria-disabled={!canCalculate}
          >
            <Calculator className="h-4 w-4" />
            {canCalculate ? "計算最優刷卡組合" : "請先輸入金額並選擇卡片"}
          </button>

          {/* Step 4 — Result (only shown after calculate) */}
          {result && (
            <>
              <div className="h-px bg-border" role="separator" />
              <ResultPanel result={result} destination={destination} stepNumber={3} partySize={partySize} holderCounts={holderCounts} />
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs text-muted-foreground/75 text-center leading-relaxed">
            最新權益基準日：2026/04/08
          </p>
          <p className="mt-2 text-xs text-muted-foreground/65 text-center leading-relaxed">
            免責聲明：本工具之計算結果僅供參考，各信用卡回饋詳情、登錄限額及活動期限悉依各發卡銀行官網公告為準。本站不保證資訊之即時性與精確性，亦不負擔任何因使用本工具而產生之消費爭議或損失。刷卡前請務必再次確認銀行最新條款。
          </p>
        </div>
      </footer>
    </div>
  );
}
