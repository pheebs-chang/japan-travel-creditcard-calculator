"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ShoppingBag,
  Building2,
  Store,
  UtensilsCrossed,
  Train,
  Sparkles,
  Cpu,
  Plane,
  Hotel,
  Car,
  X,
  ChevronRight,
  Star,
  Info,
  Users,
  Lightbulb,
} from "lucide-react";
import {
  SPENDING_PATTERNS,
  SpendingPattern,
  BrandItem,
  BrandGroup,
} from "@/lib/spend-patterns";
import type { PaymentChannel } from "@/lib/calculator";
import { defaultPaymentForPattern } from "@/lib/calculator";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const IC_CARD_IDS = new Set(["suica", "pasmo", "icoca", "jp_ic_wallet_topup"]);
/** 國內交通等：不顯示「DBS 5%」行銷標籤（與星展權益試算邏輯無關） */
const HIDE_DBS_GENERIC_BADGE = new Set(["taiwan_hsr_all", "taoyuan_airport_metro"]);

const PATTERN_PAY_OPTIONS: { value: PaymentChannel; label: string }[] = [
  { value: "physical", label: "實體刷卡" },
  { value: "apple_pay", label: "Apple Pay／感應" },
  { value: "online", label: "線上結帳" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface SpendingPatternPanelProps {
  patternAmounts: Record<string, number>;
  selectedBrands: Record<string, string>;
  partySize?: number;
  /** 交通 IC：是否為 Apple Pay 儲值（預設 true，與舊版 DBS 排除邏輯相容） */
  applePayByBrand?: Record<string, boolean>;
  onApplePayByBrandChange?: (brandId: string, value: boolean) => void;
  patternPaymentByKey?: Record<string, PaymentChannel>;
  onPatternPaymentChange?: (key: string, channel: PaymentChannel) => void;
  onChange: Dispatch<SetStateAction<Record<string, number>>>;
  onBrandChange: Dispatch<SetStateAction<Record<string, string>>>;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag, Building2, Store, UtensilsCrossed,
  Train, Sparkles, Cpu, Plane, Hotel, Car,
};

function formatNum(n: number) {
  return new Intl.NumberFormat("zh-TW").format(Math.round(n));
}

// ── BrandInputRow — input box variant ────────────────────────────────────────
// For per-person items: shows NT$[input] × N 人 = total
// For total items:      shows NT$[input] (預計總金額)

function BrandInputRow({
  brand,
  amount,       // stored amount (already = unitAmount × qty for perPerson, or direct total)
  perPerson,
  partySize,
  placeholder,
  onChange,
  onSelect,
  showApplePayToggle,
  applePayEnabled,
  onApplePayChange,
  paymentKey,
  paymentValue,
  onPaymentChange,
}: {
  brand: BrandItem;
  amount: number;    // current stored amount
  perPerson: boolean;
  partySize: number;
  placeholder?: string;
  onChange: (newAmount: number, brandId: string) => void;
  onSelect: (brandId: string) => void;
  showApplePayToggle?: boolean;
  applePayEnabled?: boolean;
  onApplePayChange?: (enabled: boolean) => void;
  paymentKey: string;
  paymentValue: PaymentChannel;
  onPaymentChange?: (key: string, channel: PaymentChannel) => void;
}) {
  // For per-person: we show the per-unit input; stored = unitAmount * partySize
  // For total: we show the total input directly
  const displayValue = perPerson && partySize > 1
    ? (amount > 0 ? Math.round(amount / partySize) : "")
    : (amount > 0 ? amount : "");

  const handleChange = (raw: string) => {
    const v = parseFloat(raw) || 0;
    const stored = perPerson && partySize > 1 ? v * partySize : v;
    onChange(stored, brand.id);
    if (v > 0) onSelect(brand.id);
  };

  const isKkday = brand.isKkday;

  return (
    <div className={cn(
      "rounded-lg border transition-colors duration-200",
      brand.highlight && "ring-1 ring-cyan-500/40 shadow-[0_0_0_1px_rgba(6,182,212,0.25)] bg-cyan-500/5",
      amount > 0 ? "border-foreground/20 bg-foreground/3" : "border-border/60 bg-transparent",
      !brand.highlight && "hover:border-foreground/30"
    )}>
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* Brand info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={cn(
              "text-[13px] font-medium",
              amount > 0 ? "text-foreground" : "text-muted-foreground"
            )}>
              {brand.name}
            </span>
            {brand.isKumamonEligible && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[8px] font-medium text-foreground/70">
                <Star className="h-2 w-2" />{"8.5%"}
              </span>
            )}
            {brand.isDbsEcoExcluded && (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-600">
                {"DBS 1%"}
              </span>
            )}
            {isKkday && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-medium text-sky-600">
                {"KKday"}
              </span>
            )}
            {brand.preferredRewardsLabel && (
              <span className="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-violet-700 dark:text-violet-200">
                {brand.preferredRewardsLabel}
              </span>
            )}
            {!brand.isDbsEcoExcluded &&
              !brand.isKumamonEligible &&
              !isKkday &&
              !HIDE_DBS_GENERIC_BADGE.has(brand.id) &&
              !brand.preferredRewardsLabel && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-600">
                {"DBS 5%"}
              </span>
            )}
          </div>

          {/* Input row */}
          {perPerson && partySize > 1 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">NT$</span>
              <input
                type="number"
                min="0"
                step="100"
                placeholder={placeholder ?? String(brand.unitPrice ?? 0)}
                value={displayValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-24 bg-secondary/50 border border-border rounded px-2 py-1 text-right text-foreground font-mono text-xs font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />
                {`× ${partySize} 人`}
              </span>
              {amount > 0 && (
                <span className="text-[11px] font-mono font-semibold text-foreground ml-1">
                  {`= NT$${formatNum(amount)}`}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">NT$</span>
              <input
                type="number"
                min="0"
                step="100"
                placeholder={placeholder ?? "0"}
                value={displayValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-36 bg-secondary/50 border border-border rounded px-2 py-1 text-right text-foreground font-mono text-xs font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-muted-foreground/60">{"總金額"}</span>
            </div>
          )}

          {showApplePayToggle && onApplePayChange && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border/50 bg-secondary/25 px-2.5 py-2">
              <span className="text-[10px] text-muted-foreground leading-tight">
                Apple Pay 儲值（影響星展／台新／富邦等判斷）
              </span>
              <Switch
                checked={applePayEnabled ?? true}
                onCheckedChange={onApplePayChange}
                aria-label={`${brand.name} Apple Pay 儲值`}
                className="scale-90"
              />
            </div>
          )}

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              amount > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden min-h-0">
              {onPaymentChange && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-border/40">
                  <span className="text-[10px] font-medium text-muted-foreground">支付方式</span>
                  <div className="flex flex-wrap gap-1">
                    {PATTERN_PAY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          "inline-flex cursor-pointer items-center rounded-full border px-2 py-1 text-[9px] font-medium transition-colors duration-200",
                          paymentValue === opt.value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-secondary/30 text-muted-foreground hover:border-foreground/20"
                        )}
                      >
                        <input
                          type="radio"
                          name={`pay-${paymentKey}`}
                          className="sr-only"
                          checked={paymentValue === opt.value}
                          onChange={() => onPaymentChange(paymentKey, opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Special note */}
          {brand.specialNote && amount > 0 && (
            <p className="mt-1.5 flex items-start gap-1 text-[9px] text-muted-foreground/60 leading-relaxed">
              <Info className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
              {brand.specialNote}
            </p>
          )}

          {/* KKday tip when amount is large */}
          {isKkday && amount === 0 && (
            <p className="mt-1 text-[9px] text-sky-600/70">{"適合購買 JR Pass、樂園門票、網卡"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SpendingPatternPanel({
  patternAmounts,
  selectedBrands,
  partySize = 1,
  applePayByBrand = {},
  onApplePayByBrandChange,
  patternPaymentByKey = {},
  onPatternPaymentChange,
  onChange,
  onBrandChange,
}: SpendingPatternPanelProps) {
  // Which patterns have been added
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  // Which patterns are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Which sub-groups are expanded: key = `${patternId}:${subGroupId}`
  const [expandedSubGroups, setExpandedSubGroups] = useState<Set<string>>(new Set());
  // Per-brand amount: key = `${patternId}:${brandId}` — stores FINAL amount (unit × qty for perPerson)
  const [brandAmounts, setBrandAmounts] = useState<Record<string, number>>({});
  // Selected brands per sub-group (manualInput, multi-select): key = `${patternId}:${sgId}`
  const [subGroupBrands, setSubGroupBrands] = useState<Record<string, string[]>>({});

  const selectablePatterns = SPENDING_PATTERNS.filter((p) => p.id !== "flight_booking");
  const addedPatterns = selectablePatterns.filter((p) => addedIds.has(p.id));
  const availablePatterns = selectablePatterns.filter((p) => !addedIds.has(p.id));

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSubGroup = (key: string) =>
    setExpandedSubGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const addPattern = (pattern: SpendingPattern) => {
    setAddedIds((prev) => new Set(prev).add(pattern.id));
    setExpandedIds((prev) => new Set(prev).add(pattern.id));
    // Auto-expand all sub-groups
    if (pattern.subGroups) {
      setExpandedSubGroups((prev) => {
        const next = new Set(prev);
        for (const sg of pattern.subGroups!) next.add(`${pattern.id}:${sg.id}`);
        return next;
      });
    }
    onChange((prev) => ({ ...prev, [pattern.id]: prev[pattern.id] ?? 0 }));
  };

  const removePattern = (id: string) => {
    setAddedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setExpandedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    onChange((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onBrandChange((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBrandAmounts((prev) => {
      const n = { ...prev };
      for (const k of Object.keys(n)) { if (k.startsWith(`${id}:`)) delete n[k]; }
      return n;
    });
    setSubGroupBrands((prev) => {
      const n = { ...prev };
      for (const k of Object.keys(n)) { if (k.startsWith(`${id}:`)) delete n[k]; }
      return n;
    });
  };

  // Recalculate pattern total from all brand amounts
  const recalcTotal = (
    pattern: SpendingPattern,
    nextBrandAmounts: Record<string, number>
  ): number => {
    return Object.entries(nextBrandAmounts)
      .filter(([k]) => k.startsWith(`${pattern.id}:`))
      .reduce((sum, [, v]) => sum + (v ?? 0), 0);
  };

  // Handle amount change for any brand
  const handleBrandAmount = (
    pattern: SpendingPattern,
    brand: BrandItem,
    newAmount: number,
    selectedBrandId: string
  ) => {
    const key = `${pattern.id}:${brand.id}`;
    const nextBrandAmounts = { ...brandAmounts, [key]: newAmount };
    setBrandAmounts(nextBrandAmounts);

    const total = recalcTotal(pattern, nextBrandAmounts);
    onChange((prev) => ({ ...prev, [pattern.id]: total }));

    // Update selected brand (last brand with amount > 0)
    if (newAmount > 0) {
      onBrandChange((prev) => ({ ...prev, [pattern.id]: selectedBrandId }));
    }
  };

  // Handle sub-group brand selection (for manualInput groups, multi-select)
  const handleToggleSubGroupBrand = (
    pattern: SpendingPattern,
    sg: BrandGroup,
    brandId: string
  ) => {
    const key = `${pattern.id}:${sg.id}`;
    const current = subGroupBrands[key] ?? [];
    const exists = current.includes(brandId);
    const nextSelected = exists ? current.filter((id) => id !== brandId) : [...current, brandId];
    const nextSubGroups = { ...subGroupBrands, [key]: nextSelected };
    setSubGroupBrands(nextSubGroups);

    const nextBrandAmounts = { ...brandAmounts };
    if (exists) {
      delete nextBrandAmounts[`${pattern.id}:${brandId}`];
    } else {
      nextBrandAmounts[`${pattern.id}:${brandId}`] = nextBrandAmounts[`${pattern.id}:${brandId}`] ?? 0;
    }
    setBrandAmounts(nextBrandAmounts);
    const total = recalcTotal(pattern, nextBrandAmounts);
    onChange((prev) => ({ ...prev, [pattern.id]: total }));

    if (!exists) {
      onBrandChange((prev) => ({ ...prev, [pattern.id]: brandId }));
    } else {
      onBrandChange((prev) => {
        if (prev[pattern.id] !== brandId) return prev;
        const next = { ...prev };
        const fallback = nextSelected[0];
        if (fallback) next[pattern.id] = fallback;
        else delete next[pattern.id];
        return next;
      });
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const getBrandAmount = (patternId: string, brandId: string) =>
    brandAmounts[`${patternId}:${brandId}`] ?? 0;

  const getPaymentForBrand = (pattern: SpendingPattern, brandId: string): PaymentChannel => {
    const key = `${pattern.id}:${brandId}`;
    if (patternPaymentByKey[key]) return patternPaymentByKey[key];
    if (brandId === "taoyuan_airport_metro" || brandId === "taiwan_hsr_all") return "physical";
    // 交通卡儲值預設為 Apple Pay／感應，符合實務情境。
    if (IC_CARD_IDS.has(brandId)) return "apple_pay";
    const fallback = defaultPaymentForPattern(pattern.category, pattern.id, pattern.label);
    return fallback;
  };

  const getSubGroupTotal = (pattern: SpendingPattern, sg: BrandGroup) => {
    const base = sg.brands.reduce((sum, b) => sum + getBrandAmount(pattern.id, b.id), 0);
    const otherId = `${sg.id}__other`;
    return base + getBrandAmount(pattern.id, otherId);
  };

  // Check if any KKday brand has a high amount (show tip if total > 10000)
  const getKkdayTip = (pattern: SpendingPattern): string | null => {
    const allBrands: BrandItem[] = [];
    if (pattern.subGroups) {
      for (const sg of pattern.subGroups) allBrands.push(...sg.brands);
    } else if (pattern.brands) allBrands.push(...pattern.brands);

    const hasLargeKkday = allBrands.some(
      (b) => b.isKkday && getBrandAmount(pattern.id, b.id) > 10000
    );
    if (hasLargeKkday) {
      return "建議使用台新 FlyGo 卡在 KKday 購票，可享 5% 回饋（上限 NT$1,200）";
    }
    return null;
  };

  // ── Render brand list ──────────────────────────────────────────────────────

  const renderSubGroupContent = (pattern: SpendingPattern, sg: BrandGroup) => {
    if (sg.manualInput) {
      // Shopping/total: multi-select brand chips + per-brand input
      const sgKey = `${pattern.id}:${sg.id}`;
      const activeBrands = subGroupBrands[sgKey] ?? [];
      const otherId = `${sg.id}__other`;
      const allOptions: BrandItem[] = [
        ...sg.brands,
        { id: otherId, name: "其他商店", unitPrice: 0 },
      ];

      return (
        <div className="px-4 py-3">
          <p className="text-[10px] text-muted-foreground/60 mb-2">{"選擇品牌（可複選）："}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {allOptions.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => handleToggleSubGroupBrand(pattern, sg, brand.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeBrands.includes(brand.id)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {brand.name}
                {brand.isKumamonEligible && brand.id !== otherId && (
                  <span className={cn("inline-flex items-center gap-0.5 text-[8px]", activeBrands.includes(brand.id) ? "text-background/70" : "text-foreground/50")}>
                    <Star className="h-2 w-2" />{"8.5%"}
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeBrands.length === 0 && (
            <p className="text-[9px] text-muted-foreground/50">請先選擇至少一個品牌，再分別輸入金額。</p>
          )}
          <div className="space-y-2">
            {activeBrands.map((brandId) => {
              const brand = allOptions.find((b) => b.id === brandId) ?? { id: brandId, name: brandId };
              const amount = getBrandAmount(pattern.id, brandId);
              return (
                <div key={brandId} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2">
                  <span className="text-[11px] text-foreground/80 min-w-0 flex-1 truncate">{brand.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">NT$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={amount || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      handleBrandAmount(pattern, brand as BrandItem, v, brandId);
                    }}
                    className="w-28 bg-transparent text-right text-foreground font-mono text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-1.5">每個品牌可分開輸入，系統會自動加總。</p>
        </div>
      );
    }

    // Normal: per-brand input boxes
    return (
      <div className={cn("px-3 py-2 space-y-2", sg.id === "ic_card" && "px-4 py-3 space-y-2.5")}>
        {sg.brands.map((brand) => (
          <BrandInputRow
            key={brand.id}
            brand={brand}
            amount={getBrandAmount(pattern.id, brand.id)}
            perPerson={sg.perPerson}
            partySize={partySize}
            placeholder={sg.perPerson ? `${brand.unitPrice ?? 0}` : "請輸入總金額"}
            onChange={(newAmount, brandId) => handleBrandAmount(pattern, brand, newAmount, brandId)}
            onSelect={(brandId) => onBrandChange((prev) => ({ ...prev, [pattern.id]: brandId }))}
            showApplePayToggle={IC_CARD_IDS.has(brand.id)}
            applePayEnabled={
              brand.id === "jp_ic_wallet_topup"
                ? applePayByBrand.jp_ic_wallet_topup ?? applePayByBrand.suica ?? true
                : applePayByBrand[brand.id] ?? true
            }
            onApplePayChange={
              IC_CARD_IDS.has(brand.id)
                ? (v) => onApplePayByBrandChange?.(brand.id, v)
                : undefined
            }
            paymentKey={`${pattern.id}:${brand.id}`}
            paymentValue={getPaymentForBrand(pattern, brand.id)}
            onPaymentChange={onPatternPaymentChange}
          />
        ))}
      </div>
    );
  };

  const renderBrandList = (pattern: SpendingPattern) => {
    if (pattern.subGroups) {
      return (
        <div className="divide-y divide-border/50">
          {pattern.subGroups.map((sg) => {
            const sgKey = `${pattern.id}:${sg.id}`;
            const sgOpen = expandedSubGroups.has(sgKey);
            const sgTotal = getSubGroupTotal(pattern, sg);

            return (
              <div key={sg.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSubGroup(sgKey)}
                  onKeyDown={(e) => e.key === "Enter" && toggleSubGroup(sgKey)}
                  className="flex items-center gap-2 px-4 py-2.5 hover:bg-secondary/30 cursor-pointer select-none transition-colors"
                  aria-expanded={sgOpen}
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0", sgOpen && "rotate-90")} />
                  <span className="flex-1 text-xs font-semibold text-foreground/80">{sg.label}</span>
                  {sg.manualInput
                    ? <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/60">{"手動輸入"}</span>
                    : sg.perPerson
                      ? <span className="inline-flex items-center gap-0.5 rounded-full border border-foreground/20 px-1.5 py-0.5 text-[9px] font-medium text-foreground/50"><Users className="h-2.5 w-2.5" />{"按人頭"}</span>
                      : <span className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/60">{"總額"}</span>
                  }
                  {sgTotal > 0 && (
                    <span className="text-[11px] font-mono font-semibold text-foreground ml-1">
                      {`NT$${formatNum(sgTotal)}`}
                    </span>
                  )}
                </div>
                <div className={cn(
                  "overflow-hidden transition-all duration-200 ease-out bg-secondary/10",
                  sgOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                )}>
                  {renderSubGroupContent(pattern, sg)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Flat brand list — per-brand input boxes
    return (
      <div className="px-3 py-2 space-y-2">
        {(pattern.brands ?? []).map((brand) => (
          <BrandInputRow
            key={brand.id}
            brand={brand}
            amount={getBrandAmount(pattern.id, brand.id)}
            perPerson={pattern.perPerson}
            partySize={partySize}
            placeholder={pattern.perPerson ? `${brand.unitPrice ?? 0}` : "請輸入總金額"}
            onChange={(newAmount, brandId) => handleBrandAmount(pattern, brand, newAmount, brandId)}
            onSelect={(brandId) => onBrandChange((prev) => ({ ...prev, [pattern.id]: brandId }))}
            showApplePayToggle={IC_CARD_IDS.has(brand.id)}
            applePayEnabled={
              brand.id === "jp_ic_wallet_topup"
                ? applePayByBrand.jp_ic_wallet_topup ?? applePayByBrand.suica ?? true
                : applePayByBrand[brand.id] ?? true
            }
            onApplePayChange={
              IC_CARD_IDS.has(brand.id)
                ? (v) => onApplePayByBrandChange?.(brand.id, v)
                : undefined
            }
            paymentKey={`${pattern.id}:${brand.id}`}
            paymentValue={getPaymentForBrand(pattern, brand.id)}
            onPaymentChange={onPatternPaymentChange}
          />
        ))}
      </div>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <section aria-label="消費樣態選擇">
      <p className="text-xs text-muted-foreground/70 mb-4 leading-relaxed">
        {partySize > 1
          ? `標示「按人頭」的項目會自動乘以 ${partySize} 人；其餘項目請直接輸入總預算。`
          : "點選分類展開品牌清單，在輸入框填入金額後自動加總。"}
      </p>

      {/* Added patterns */}
      {addedPatterns.length > 0 && (
        <div className="mb-4 space-y-2">
          {addedPatterns.map((pattern) => {
            const Icon = ICON_MAP[pattern.icon] ?? ShoppingBag;
            const isExpanded = expandedIds.has(pattern.id);
            const total = patternAmounts[pattern.id] ?? 0;
            const kkdayTip = getKkdayTip(pattern);

            return (
              <div key={pattern.id} className="rounded-xl border border-foreground/20 bg-card overflow-hidden">
                {/* Category header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(pattern.id)}
                  onKeyDown={(e) => e.key === "Enter" && toggleExpand(pattern.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors cursor-pointer select-none"
                  aria-expanded={isExpanded}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{pattern.label}</span>
                    {total > 0 && (
                      <span className="ml-2 text-xs font-mono font-semibold text-foreground/70">
                        {`NT$${formatNum(total)}`}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePattern(pattern.id); }}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-secondary hover:text-foreground transition-colors"
                    aria-label={`Remove ${pattern.id}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* KKday tip banner */}
                {kkdayTip && (
                  <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg bg-sky-500/10 px-3 py-2">
                    <Lightbulb className="h-3.5 w-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-sky-600 leading-relaxed">{kkdayTip}</p>
                  </div>
                )}

                {/* Expanded content */}
                <div className={cn(
                  "overflow-hidden transition-all duration-300 ease-out border-t border-border/50",
                  isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 border-t-0"
                )}>
                  {renderBrandList(pattern)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Available patterns to add */}
      {availablePatterns.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground/60 mb-2 uppercase tracking-widest font-semibold">
            {"新增消費場所"}
          </p>
          <div className="flex flex-wrap gap-2">
            {availablePatterns.map((pattern) => {
              const Icon = ICON_MAP[pattern.icon] ?? ShoppingBag;
              return (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() => addPattern(pattern)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-secondary hover:text-foreground"
                >
                  <Icon className="h-3 w-3" />
                  {pattern.label}
                </button>
              );
            })}
          </div>
          {availablePatterns.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{"所有樣態已新增"}</p>
          )}
        </div>
      )}
    </section>
  );
}
