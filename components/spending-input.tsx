"use client";

import type { Dispatch, SetStateAction } from "react";
import { Hotel, Plane, Star, Info, Users, Plus, Trash2 } from "lucide-react";
import type {
  AccommodationExpense,
  SpendingInput,
  PaymentChannel,
  DomesticRailPurchaseMode,
} from "@/lib/calculator";
import {
  FLIGHT_BOOKING_BRANDS,
  HOTEL_BOOKING_BRANDS,
  HOTEL_PLATFORM_DROPDOWN_IDS,
} from "@/lib/spend-patterns";
import { cn } from "@/lib/utils";

const PAYMENT_OPTIONS: { value: PaymentChannel; label: string }[] = [
  { value: "physical", label: "實體刷卡" },
  { value: "apple_pay", label: "Apple Pay／感應" },
  { value: "online", label: "線上結帳" },
];

function PaymentMethodField({
  value,
  onChange,
  idPrefix,
}: {
  value: PaymentChannel;
  onChange: (v: PaymentChannel) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label="支付方式">
      <span className="text-[10px] font-medium text-muted-foreground">支付方式</span>
      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] transition-all duration-200",
              value === opt.value
                ? "border-violet-500/80 bg-gradient-to-r from-violet-600 to-indigo-700 font-bold text-white shadow-sm dark:from-violet-600 dark:to-indigo-700"
                : "border-gray-700 bg-transparent font-medium text-gray-400 hover:border-gray-600"
            )}
          >
            <input
              type="radio"
              name={`${idPrefix}-pay`}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

interface SpendingInputPanelProps {
  spending: SpendingInput;
  partySize?: number;
  flightBrandId?: string | null;
  onFlightBrandIdChange?: (brandId: string | null) => void;
  isKumamonFlightJpy?: boolean;
  onKumamonFlightJpyChange?: (enabled: boolean) => void;
  onChange: Dispatch<SetStateAction<SpendingInput>>;
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

const FLIGHT_PURCHASE_OPTIONS: {
  value: DomesticRailPurchaseMode;
  label: string;
  hint: string;
}[] = [
  { value: "together", label: "一起買", hint: "單筆代購／一人刷總額" },
  { value: "split", label: "分開買", hint: "每人各自刷卡試算" },
];

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
  onChange,
}: SpendingInputPanelProps) {
  const accommodationList = spending.accommodationExpenses ?? [];

  const flightPurchaseMode = spending.flightPurchaseMode ?? "together";

  const handleFlightChange = (raw: string) => {
    const unit = parseFloat(raw.replace(/,/g, "")) || 0;
    const mode = spending.flightPurchaseMode ?? "together";
    let total = unit;
    if (partySize > 1) {
      total = mode === "split" ? unit * partySize : unit;
    }
    onChange((prev) => ({ ...prev, flight: total }));
  };

  const selectFlightBrand = (brandId: string, unitPrice: number) => {
    onFlightBrandIdChange?.(brandId);
    onChange((prev) => {
      if (prev.flight) return prev;
      const ps = partySize > 1 ? partySize : 1;
      const mode = prev.flightPurchaseMode ?? "together";
      const total = ps > 1 && mode === "split" ? unitPrice * ps : unitPrice;
      return { ...prev, flight: total };
    });
  };

  const addAccommodation = () => {
    const newId = newExpenseId();
    onChange((prev) => {
      const list = prev.accommodationExpenses ?? [];
      const nextIndex = list.length + 1;
      return {
        ...prev,
        accommodationExpenses: [
          ...list,
          { id: newId, name: `住宿 ${nextIndex}`, amount: 0, paymentMethod: "online" },
        ],
      };
    });
    // 新增後自動捲動到新卡片，避免使用者誤以為沒成功。
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-acc-id="${newId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const firstInput = el.querySelector<HTMLInputElement>("input");
      firstInput?.focus({ preventScroll: true });
    }, 80);
  };

  const updateAccommodation = (id: string, patch: Partial<AccommodationExpense>) => {
    onChange((prev) => {
      const list = prev.accommodationExpenses ?? [];
      return {
        ...prev,
        accommodationExpenses: list.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      };
    });
  };

  const removeAccommodation = (id: string) => {
    onChange((prev) => ({
      ...prev,
      accommodationExpenses: (prev.accommodationExpenses ?? []).filter((e) => e.id !== id),
    }));
  };

  const selectedFlightBrand = FLIGHT_BOOKING_BRANDS.find((b) => b.id === flightBrandId);
  const flightUnitValue =
    partySize > 1 && flightPurchaseMode === "split"
      ? Math.round((spending.flight || 0) / partySize)
      : spending.flight || 0;

  return (
    <section aria-label="線上訂機票與住宿消費金額">
      <p className="text-[10px] text-muted-foreground/80 leading-relaxed mb-3">
        若您在 Step 3「消費樣態」填寫「日本交通卡儲值 (Suica / PASMO / ICOCA)」，請於該處開啟或關閉「Apple Pay 儲值」，以正確試算星展／台新／富邦等權益。
      </p>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed mb-2">
        「桃園機場捷運」「台灣高鐵」已獨立至 Step 3「國內交通」；機票試算請在下方選擇「一起買／分開買」以符合實際刷卡方式。
      </p>
      <p className="text-[10px] text-cyan-300/90 leading-relaxed mb-2">
        💡 日本交通卡儲值（Suica / PASMO / ICOCA）採個人手機操作，系統會自動按人數拆分計算每人回饋上限。
      </p>
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
            <div
              className="mb-2.5 rounded-lg border border-border/80 bg-secondary/25 px-2.5 py-2 dark:border-white/15 dark:bg-zinc-900/60"
              role="radiogroup"
              aria-label="機票購買方式"
            >
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-400">
                購票方式
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FLIGHT_PURCHASE_OPTIONS.map((opt) => {
                  const active = flightPurchaseMode === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "inline-flex min-w-[6rem] cursor-pointer flex-col gap-0.5 rounded-md border px-2 py-1.5 text-[10px] transition-colors",
                        active
                          ? "border-violet-500/80 bg-gradient-to-r from-violet-600 to-indigo-700 font-bold text-white shadow-md dark:from-violet-600 dark:to-indigo-700"
                          : "border-gray-700 bg-transparent font-medium text-gray-400 hover:border-gray-600"
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="radio"
                          name="flight-purchase-mode"
                          value={opt.value}
                          checked={active}
                          onChange={() =>
                            onChange((prev) => ({ ...prev, flightPurchaseMode: opt.value }))
                          }
                          className="sr-only"
                        />
                        {opt.label}
                      </span>
                      <span
                        className={cn(
                          "text-[8px] leading-tight",
                          active ? "font-semibold text-white/90" : "text-gray-400"
                        )}
                      >
                        {opt.hint}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
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
                aria-label={
                  partySize > 1
                    ? flightPurchaseMode === "split"
                      ? "機票單人金額"
                      : "機票總金額（一起購買）"
                    : "機票總金額"
                }
              />
              {partySize > 1 && flightPurchaseMode === "split" && (
                <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5">
                  <Users className="h-3 w-3" />× {partySize} 人
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                window.alert("保險試算功能即將上線！");
              }}
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-left text-[11px] font-medium leading-snug text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition hover:bg-white/[0.1] dark:border-white/10 dark:bg-white/[0.04]"
            >
              🛡️ 機票買好了，那保障呢？檢視此行程的最優保險組合 (班機延誤 / 海外醫療) →
            </button>
            {partySize > 1 && spending.flight > 0 && flightPurchaseMode === "split" && (
              <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                合計 NT${formatNum(spending.flight)}
              </p>
            )}
            <p className="mt-1.5 text-[10px] text-muted-foreground/50">
              建議使用台新 FlyGo 或星展新戶卡領取 5% 回饋；JAL/ANA 建議用熊本熊卡刷日圓。
            </p>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                (spending.flight ?? 0) > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden min-h-0">
                <div className="mt-3 pt-3 border-t border-border/60">
                  <PaymentMethodField
                    idPrefix="flight"
                    value={spending.flightPaymentMethod ?? "online"}
                    onChange={(v) => onChange((prev) => ({ ...prev, flightPaymentMethod: v }))}
                  />
                </div>
              </div>
            </div>
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
                    data-acc-id={exp.id}
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
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-300 ease-out",
                        exp.amount > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      )}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="pt-2 border-t border-border/50">
                          <PaymentMethodField
                            idPrefix={`acc-${exp.id}`}
                            value={exp.paymentMethod ?? "online"}
                            onChange={(v) => updateAccommodation(exp.id, { paymentMethod: v })}
                          />
                        </div>
                      </div>
                    </div>
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

          <div className="px-4 pb-4">
            <div className="mt-4 border-t border-border/50 pt-4">
              <button
                type="button"
                onClick={addAccommodation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-foreground/30 bg-secondary/40 px-4 py-3 text-sm font-semibold text-foreground hover:border-foreground/50 hover:bg-secondary/60 transition-colors"
              >
                <Plus className="h-4 w-4" />
                新增一筆住宿
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
