"use client";

import { Hotel, Plane, Star, Info, UserCheck, Users, Plus, Trash2 } from "lucide-react";
import type { AccommodationExpense, SpendingInput } from "@/lib/calculator";
import {
  FLIGHT_BOOKING_BRANDS,
  HOTEL_BOOKING_BRANDS,
  HOTEL_PLATFORM_DROPDOWN_IDS,
} from "@/lib/spend-patterns";
import { cn } from "@/lib/utils";

interface SpendingInputPanelProps {
  spending: SpendingInput;
  partySize?: number;
  flightBrandId?: string | null;
  onFlightBrandIdChange?: (brandId: string | null) => void;
  isKumamonFlightJpy?: boolean;
  onKumamonFlightJpyChange?: (enabled: boolean) => void;
  isDbsEcoNewUser?: boolean;
  onChange: (spending: SpendingInput) => void;
  onDbsEcoNewUserChange?: (isNewUser: boolean) => void;
}

function formatNum(n: number) {
  return new Intl.NumberFormat("zh-TW").format(n);
}

function newExpenseId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const PLATFORM_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "未指定（可選）" },
  ...HOTEL_PLATFORM_DROPDOWN_IDS.map((id) => {
    const b = HOTEL_BOOKING_BRANDS.find((x) => x.id === id);
    return { value: id, label: b?.name ?? id };
  }),
];

export function SpendingInputPanel({
  spending,
  partySize = 1,
  flightBrandId = null,
  onFlightBrandIdChange,
  isKumamonFlightJpy = false,
  onKumamonFlightJpyChange,
  isDbsEcoNewUser = false,
  onChange,
  onDbsEcoNewUserChange,
}: SpendingInputPanelProps) {
  const accommodationList = spending.accommodationExpenses ?? [];

  const handleFlightChange = (raw: string) => {
    const unit = parseFloat(raw.replace(/,/g, "")) || 0;
    const total = partySize > 1 ? unit * partySize : unit;
    onChange({ ...spending, flight: total });
  };

  const selectFlightBrand = (brandId: string, unitPrice: number) => {
    onFlightBrandIdChange?.(brandId);
    if (!spending.flight) {
      const total = partySize > 1 ? unitPrice * partySize : unitPrice;
      onChange({ ...spending, flight: total });
    }
  };

  const addAccommodation = () => {
    const nextIndex = accommodationList.length + 1;
    onChange({
      ...spending,
      accommodationExpenses: [
        ...accommodationList,
        { id: newExpenseId(), name: `住宿 ${nextIndex}`, amount: 0 },
      ],
    });
  };

  const updateAccommodation = (id: string, patch: Partial<AccommodationExpense>) => {
    onChange({
      ...spending,
      accommodationExpenses: accommodationList.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const removeAccommodation = (id: string) => {
    onChange({
      ...spending,
      accommodationExpenses: accommodationList.filter((e) => e.id !== id),
    });
  };

  const selectedFlightBrand = FLIGHT_BOOKING_BRANDS.find((b) => b.id === flightBrandId);
  const flightUnitValue = partySize > 1 ? Math.round((spending.flight || 0) / partySize) : (spending.flight || 0);

  return (
    <section aria-label="線上訂機票與住宿消費金額">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-foreground/30">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Plane className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">線上訂機票</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Trip.com / JAL / ANA / Tigerair / Peach / Starlux / EVA Air / China Airlines
              </p>
            </div>
          </div>

          <div className="px-4 pb-2">
            <div className="flex flex-wrap gap-2">
              {FLIGHT_BOOKING_BRANDS.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => selectFlightBrand(brand.id, brand.unitPrice ?? 0)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    flightBrandId === brand.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {brand.name}
                  {brand.isKumamonEligible && (
                    <span className={cn("inline-flex items-center gap-0.5 text-[9px]", flightBrandId === brand.id ? "text-background/80" : "text-foreground/70")}>
                      <Star className="h-2.5 w-2.5" />8.5%
                    </span>
                  )}
                </button>
              ))}
            </div>
            {selectedFlightBrand?.specialNote && (
              <p className="mt-2 text-[10px] text-muted-foreground/60 flex items-start gap-1">
                <Info className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                {selectedFlightBrand.specialNote}
              </p>
            )}
          </div>

          <div className="px-4 pb-4 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <span className="text-xs text-muted-foreground font-mono flex-shrink-0">NT$</span>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={flightUnitValue || ""}
                onChange={(e) => handleFlightChange(e.target.value)}
                className="flex-1 bg-transparent text-foreground font-mono text-base font-semibold placeholder:text-muted-foreground/40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="機票單人金額"
              />
              {partySize > 1 && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Users className="h-3 w-3" />× {partySize} 人
                </span>
              )}
            </div>
            {partySize > 1 && spending.flight > 0 && (
              <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                合計 NT${formatNum(spending.flight)}
              </p>
            )}
            <p className="mt-1.5 text-[10px] text-muted-foreground/50">
              建議使用台新 FlyGo 或星展新戶卡領取 5% 回饋；JAL/ANA 建議用熊本熊卡刷日圓。
            </p>
            {(selectedFlightBrand?.id === "jal" || selectedFlightBrand?.id === "ana") && onKumamonFlightJpyChange && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onKumamonFlightJpyChange(!isKumamonFlightJpy)}
                onKeyDown={(e) => e.key === "Enter" && onKumamonFlightJpyChange(!isKumamonFlightJpy)}
                className={cn(
                  "mt-2 flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer select-none transition-colors",
                  isKumamonFlightJpy
                    ? "border-foreground/30 bg-foreground/5"
                    : "border-border bg-card hover:border-foreground/20"
                )}
                aria-pressed={isKumamonFlightJpy}
              >
                <div className={cn(
                  "flex h-4 w-7 flex-shrink-0 rounded-full border-2 transition-colors relative",
                  isKumamonFlightJpy ? "bg-foreground border-foreground" : "bg-secondary border-border"
                )}>
                  <div className={cn(
                    "absolute top-0.5 h-2 w-2 rounded-full transition-all",
                    isKumamonFlightJpy ? "left-3.5 bg-background" : "left-0.5 bg-muted-foreground/50"
                  )} />
                </div>
                <p className="text-[11px] text-foreground/80">
                  JAL/ANA 官網且以日圓結帳（熊本熊卡可評估 8.5%）
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors hover:border-foreground/30">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Hotel className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">線上訂住宿</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                多間飯店請分開新增；每筆為獨立一筆刷卡建議，不會依旅遊人數拆金額。
              </p>
            </div>
          </div>

          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={addAccommodation}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5 text-xs font-medium text-foreground hover:border-foreground/40 hover:bg-secondary/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              新增一筆住宿
            </button>
          </div>

          {accommodationList.length === 0 ? (
            <div className="px-4 pb-4">
              <p className="text-xs text-muted-foreground/70 text-center py-6 rounded-lg border border-border/60 bg-secondary/20">
                尚無住宿資料，請點「新增一筆住宿」
              </p>
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-3">
              {accommodationList.map((exp) => {
                const brandNote = exp.platform
                  ? HOTEL_BOOKING_BRANDS.find((b) => b.id === exp.platform)?.specialNote
                  : undefined;
                return (
                  <div
                    key={exp.id}
                    className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">住宿訂單</p>
                      <button
                        type="button"
                        onClick={() => removeAccommodation(exp.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`刪除 ${exp.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                        刪除
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] text-muted-foreground">自訂名稱</span>
                        <input
                          type="text"
                          value={exp.name}
                          onChange={(e) => updateAccommodation(exp.id, { name: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40"
                          placeholder="住宿 1"
                          aria-label="住宿自訂名稱"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] text-muted-foreground">金額（NT$）</span>
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
                          <span className="text-xs text-muted-foreground font-mono">NT$</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="0"
                            value={exp.amount || ""}
                            onChange={(e) =>
                              updateAccommodation(exp.id, {
                                amount: parseFloat(e.target.value.replace(/,/g, "")) || 0,
                              })
                            }
                            className="flex-1 bg-transparent font-mono text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label={`${exp.name} 金額`}
                          />
                        </div>
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] text-muted-foreground">訂房平台（可選）</span>
                      <select
                        value={exp.platform ?? ""}
                        onChange={(e) =>
                          updateAccommodation(exp.id, {
                            platform: e.target.value === "" ? undefined : e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-foreground/40"
                        aria-label={`${exp.name} 訂房平台`}
                      >
                        {PLATFORM_SELECT_OPTIONS.map((opt) => (
                          <option key={opt.value || "unset"} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {brandNote && (
                      <p className="text-[10px] text-muted-foreground/70 flex items-start gap-1">
                        <Info className="h-2.5 w-2.5 flex-shrink-0 mt-0.5" />
                        {brandNote}
                      </p>
                    )}
                    {exp.platform === "rakuten_travel_tw" && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-2">
                        <Info className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-600 leading-relaxed">
                          使用樂天旅遊中文版，熊本熊卡僅享一般回饋。改用日文版可享 8.5%。
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {onDbsEcoNewUserChange && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onDbsEcoNewUserChange(!isDbsEcoNewUser)}
            onKeyDown={(e) => e.key === "Enter" && onDbsEcoNewUserChange(!isDbsEcoNewUser)}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 cursor-pointer select-none transition-colors",
              isDbsEcoNewUser
                ? "border-foreground/30 bg-foreground/5"
                : "border-border bg-card hover:border-foreground/20"
            )}
            aria-pressed={isDbsEcoNewUser}
          >
            <div className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
              isDbsEcoNewUser ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            )}>
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{"我是星展 eco 永續卡新戶"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {"新戶核卡專屬期間，線上訂房/訂機票等旅遊平台享 5% 加碼（消費上限 NT$ 15,000）"}
              </p>
            </div>
            <div className={cn(
              "flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors relative",
              isDbsEcoNewUser ? "bg-foreground border-foreground" : "bg-secondary border-border"
            )}>
              <div className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full transition-all",
                isDbsEcoNewUser ? "left-4 bg-background" : "left-0.5 bg-muted-foreground/50"
              )} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
