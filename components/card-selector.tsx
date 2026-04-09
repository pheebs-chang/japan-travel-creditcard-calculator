"use client";

// Card selection component with holder count support
import { Check, Minus, Plus, Users } from "lucide-react";
import { CREDIT_CARDS, CreditCard, getSinopacDisplayMaxSpending } from "@/lib/card-data";
import type { CardEngagementSnapshot } from "@/lib/card-engagement-analytics";
import {
  computeOspIndex,
  getIndividualAlpha,
  rankPositionByNetInBreakdown,
  trackCardDetailEngagement,
} from "@/lib/card-engagement-analytics";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

function formatCeiling(rule: CreditCard["cashback"][number]): string | null {
  if (rule.maxSpending == null) return null;
  const amount = new Intl.NumberFormat("zh-TW").format(Math.floor(rule.maxSpending));
  return `${rule.maxSpendingIsApprox ? "約 " : ""}刷卡上限 NT$ ${amount}`;
}

interface CardSelectorProps {
  selected: string[];
  holderCounts?: Record<string, number>; // cardId -> number of holders in party
  partySize?: number;
  /** 永豐幣倍卡：Level 1 加碼 NT$300／月（刷卡上限約 NT$7,500）；Level 2 NT$800／月（約 NT$20,000） */
  sinopacDoublebeiLevel?: 1 | 2;
  onSinopacDoublebeiLevelChange?: (level: 1 | 2) => void;
  isDbsEcoNewUser?: boolean;
  onDbsEcoNewUserChange?: (v: boolean) => void;
  isSinopacNewUser?: boolean;
  onSinopacNewUserChange?: (v: boolean) => void;
  isUnionJingheNewUser?: boolean;
  onUnionJingheNewUserChange?: (v: boolean) => void;
  onSelectedChange: (selected: string[]) => void;
  onHolderCountsChange?: (counts: Record<string, number>) => void;
  /** 最近一次試算結果：用於卡名連結埋點（alpha、OSP、淨回饋名次） */
  engagementSnapshot?: CardEngagementSnapshot | null;
}

export function CardBadge({
  card,
  selected,
  holderCount,
  partySize,
  sinopacDoublebeiLevel,
  onSinopacDoublebeiLevelChange,
  isDbsEcoNewUser,
  onDbsEcoNewUserChange,
  isSinopacNewUser,
  onSinopacNewUserChange,
  isUnionJingheNewUser,
  onUnionJingheNewUserChange,
  onToggleSelected,
  onHolderCountChange,
  engagementSnapshot,
}: {
  card: CreditCard;
  selected: boolean;
  holderCount: number;
  partySize: number;
  sinopacDoublebeiLevel?: 1 | 2;
  onSinopacDoublebeiLevelChange?: (level: 1 | 2) => void;
  isDbsEcoNewUser?: boolean;
  onDbsEcoNewUserChange?: (v: boolean) => void;
  isSinopacNewUser?: boolean;
  onSinopacNewUserChange?: (v: boolean) => void;
  isUnionJingheNewUser?: boolean;
  onUnionJingheNewUserChange?: (v: boolean) => void;
  onToggleSelected: () => void;
  onHolderCountChange: (delta: number) => void;
  engagementSnapshot?: CardEngagementSnapshot | null;
}) {
  const isInverted = selected;
  const cardDocUrl = card.officialUrl ?? card.registrationUrl;
  const sinopacLevelResolved = sinopacDoublebeiLevel ?? 1;

  return (
    <div
      className={cn(
        "relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border p-4 transition-all duration-200",
        isInverted
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground"
      )}
    >
      {/* 主內容區 flex-1：供 footer mt-auto 對齊卡片底部 */}
      <div className="flex min-h-0 flex-1 flex-col gap-y-2">
        {/* 卡名（官方連結）＋外觀說明＋標籤＋銀行 — 不可包在 button 內（避免 a 巢狀無效） */}
        <div className="flex w-full min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 flex flex-col gap-y-1">
            <a
              href={cardDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block w-fit max-w-full text-left text-base font-semibold leading-snug tracking-tight underline-offset-2 hover:underline",
                isInverted ? "text-background" : "text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                const bd = engagementSnapshot?.cardBreakdown ?? [];
                const totalNet = engagementSnapshot?.totalNetCashback ?? 0;
                const visualRank = CREDIT_CARDS.findIndex((c) => c.id === card.id) + 1;
                const netRank = rankPositionByNetInBreakdown(card.id, bd);
                trackCardDetailEngagement({
                  cardId: card.id,
                  cardName: card.name,
                  engagement_type: "Identity_Confirmation",
                  individual_alpha: getIndividualAlpha(card.id, bd),
                  osp_index_at_click: computeOspIndex(bd, totalNet),
                  rank_position: netRank ?? visualRank,
                  model_alpha: engagementSnapshot?.model_alpha,
                  n_calc: engagementSnapshot?.n_calc,
                });
              }}
            >
              {card.name}
            </a>
            {card.appearance ? (
              <p
                className={cn(
                  "text-[10px] leading-snug",
                  isInverted ? "text-background/55" : "text-gray-500 dark:text-gray-400"
                )}
              >
                {card.appearance}
              </p>
            ) : null}
            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "inline-flex rounded-full border px-1.5 py-px text-[8px] font-semibold leading-tight",
                      isInverted
                        ? "border-background/25 bg-background/15 text-background"
                        : "border-border bg-secondary text-muted-foreground"
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p
              className={cn(
                "text-left text-[10px] leading-snug",
                isInverted ? "text-background/50" : "text-gray-400 dark:text-gray-500"
              )}
            >
              {card.bank}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleSelected}
            aria-pressed={selected}
            aria-label={`${selected ? "取消選取" : "選取"} ${card.name}`}
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
              isInverted ? "border-background/60 bg-background" : "border-border hover:bg-secondary"
            )}
          >
            {selected ? <Check className="h-3 w-3 text-foreground" strokeWidth={3} /> : null}
          </button>
        </div>

        {/* 福利網格與備註：點擊可切換選取 */}
        <button
          type="button"
          onClick={onToggleSelected}
          aria-pressed={selected}
          aria-label={`${selected ? "取消選取" : "選取"} ${card.name}（福利試算區）`}
          className="flex w-full flex-col gap-y-2 p-0 text-left"
        >
          <div className="grid grid-cols-2 items-stretch gap-1.5">
            {card.cashback.map((rule) => {
              const ceilingRule =
                card.id === "sinopac-doublebei"
                  ? { ...rule, maxSpending: getSinopacDisplayMaxSpending(sinopacLevelResolved) }
                  : rule;
              return (
                <div
                  key={rule.category}
                  className={cn(
                    "flex h-full min-h-[60px] min-w-0 flex-col justify-between rounded-md px-1.5 py-1.5",
                    isInverted ? "bg-background/10" : "bg-secondary"
                  )}
                >
                  <p
                    className={cn(
                      "shrink-0 text-[8px] leading-tight",
                      isInverted ? "text-background/70" : "text-muted-foreground"
                    )}
                  >
                    {rule.label}
                  </p>
                  <div className="mt-0.5 flex min-h-0 flex-1 flex-col justify-center gap-0.5">
                    <div className="flex flex-wrap items-end justify-between gap-x-0.5 gap-y-0.5">
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px] font-bold tabular-nums leading-none",
                          isInverted ? "text-background" : "text-foreground"
                        )}
                      >
                        {rule.rate}%
                      </span>
                      {ceilingRule.maxSpending !== undefined && (
                        <span
                          className={cn(
                            "max-w-[min(100%,8.5rem)] text-right text-[7px] leading-tight break-words",
                            isInverted ? "text-background/55" : "text-muted-foreground"
                          )}
                        >
                          {formatCeiling(ceilingRule)}
                        </span>
                      )}
                    </div>
                    {rule.ruleNote && (
                      <p
                        className={cn(
                          "line-clamp-2 text-[7px] leading-tight",
                          isInverted ? "text-background/45" : "text-muted-foreground/80"
                        )}
                      >
                        {rule.ruleNote}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {card.notes && (
            <p
              title={card.notes}
              className={cn(
                "line-clamp-3 text-left text-[10px] leading-tight",
                isInverted ? "text-background/85" : "text-muted-foreground"
              )}
            >
              {card.notes}
            </p>
          )}
        </button>

        {/* Divider：與 p-4 對齊全寬 */}
        <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />

      {/* 永豐幣倍：會員等級 */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          card.id === "sinopac-doublebei" && selected && onSinopacDoublebeiLevelChange
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden min-h-0">
          {card.id === "sinopac-doublebei" && selected && onSinopacDoublebeiLevelChange && (
            <>
              <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="flex w-full flex-col gap-1.5 py-2">
                <span className={cn("text-[10px] font-medium", isInverted ? "text-background/70" : "text-muted-foreground")}>
                  會員等級（加碼上限）
                </span>
                <div className="grid w-full grid-cols-2 gap-2">
                  {([1, 2] as const).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSinopacDoublebeiLevelChange(lv);
                      }}
                      className={cn(
                        "w-full min-w-0 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors duration-200",
                        (sinopacDoublebeiLevel ?? 1) === lv
                          ? isInverted
                            ? "border-background bg-background text-foreground"
                            : "border-foreground bg-foreground text-background"
                          : isInverted
                            ? "border-background/25 text-background/80 hover:bg-background/10"
                            : "border-border text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {lv === 1 ? "一般戶（Level 1）" : "大戶（Level 2）"}
                    </button>
                  ))}
                </div>
                <p className={cn("text-[9px] leading-snug", isInverted ? "text-background/45" : "text-muted-foreground/70")}>
                  Level 1：+4% 月上限 NT$300；Level 2：+4% 月上限 NT$800
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 新戶加碼：星展 eco／聯邦吉鶴／永豐幣倍 */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          selected &&
            ((card.id === "dbs-eco" && onDbsEcoNewUserChange) ||
              (card.id === "union-jinghe" && onUnionJingheNewUserChange) ||
              (card.id === "sinopac-doublebei" && onSinopacNewUserChange))
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden min-h-0">
          {selected && card.id === "dbs-eco" && onDbsEcoNewUserChange && (
            <>
              <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="flex items-center justify-between gap-2 py-2">
                <span className={cn("text-[10px] leading-tight flex-1", isInverted ? "text-background/80" : "text-foreground/90")}>
                  是否為新戶（享額外加碼）？
                </span>
                <Switch
                  checked={!!isDbsEcoNewUser}
                  onCheckedChange={onDbsEcoNewUserChange}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="星展 eco 新戶"
                  className={cn("scale-75 flex-shrink-0", isInverted ? "data-[state=checked]:bg-background" : "")}
                />
              </div>
            </>
          )}
          {selected && card.id === "union-jinghe" && onUnionJingheNewUserChange && (
            <>
              <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="flex items-center justify-between gap-2 py-2">
                <span className={cn("text-[10px] leading-tight flex-1", isInverted ? "text-background/80" : "text-foreground/90")}>
                  是否為新戶（享額外加碼）？
                </span>
                <Switch
                  checked={!!isUnionJingheNewUser}
                  onCheckedChange={onUnionJingheNewUserChange}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="聯邦吉鶴新戶"
                  className={cn("scale-75 flex-shrink-0", isInverted ? "data-[state=checked]:bg-background" : "")}
                />
              </div>
            </>
          )}
          {selected && card.id === "sinopac-doublebei" && onSinopacNewUserChange && (
            <>
              <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="flex items-center justify-between gap-2 py-2">
                <span className={cn("text-[10px] leading-tight flex-1", isInverted ? "text-background/80" : "text-foreground/90")}>
                  是否為新戶（享額外加碼）？
                </span>
                <Switch
                  checked={!!isSinopacNewUser}
                  onCheckedChange={onSinopacNewUserChange}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="永豐幣倍新戶"
                  className={cn("scale-75 flex-shrink-0", isInverted ? "data-[state=checked]:bg-background" : "")}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Holder count row - only show when party > 1 and card is selected */}
      {partySize > 1 && selected && (
        <>
          <div className={cn("-mx-4 h-px shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
          <div className="flex items-center justify-between gap-2 py-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users
                className={cn(
                  "h-3.5 w-3.5 flex-shrink-0",
                  isInverted ? "text-background/60" : "text-muted-foreground"
                )}
              />
              <span className={cn(
                "text-[10px] font-medium",
                isInverted ? "text-background/70" : "text-muted-foreground"
              )}>
                團內持有
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHolderCountChange(-1); }}
                disabled={holderCount <= 1}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                  holderCount > 1
                    ? isInverted 
                      ? "border-background/40 text-background hover:bg-background/20"
                      : "border-foreground/30 text-foreground hover:bg-secondary"
                    : isInverted
                      ? "border-background/20 text-background/30 cursor-not-allowed"
                      : "border-border text-muted-foreground/30 cursor-not-allowed"
                )}
                aria-label="減少持有數量"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className={cn(
                "w-5 text-center font-mono text-xs font-bold",
                isInverted ? "text-background" : "text-foreground"
              )}>
                {holderCount}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onHolderCountChange(1); }}
                disabled={holderCount >= partySize}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                  holderCount < partySize
                    ? isInverted 
                      ? "border-background/40 text-background hover:bg-background/20"
                      : "border-foreground/30 text-foreground hover:bg-secondary"
                    : isInverted
                      ? "border-background/20 text-background/30 cursor-not-allowed"
                      : "border-border text-muted-foreground/30 cursor-not-allowed"
                )}
                aria-label="增加持有數量"
              >
                <Plus className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        </>
      )}

      </div>
    </div>
  );
}

export function CardSelector({
  selected,
  holderCounts = {},
  partySize = 1,
  sinopacDoublebeiLevel = 1,
  onSinopacDoublebeiLevelChange,
  isDbsEcoNewUser = false,
  onDbsEcoNewUserChange,
  isSinopacNewUser = false,
  onSinopacNewUserChange,
  isUnionJingheNewUser = false,
  onUnionJingheNewUserChange,
  onSelectedChange,
  onHolderCountsChange,
  engagementSnapshot = null,
}: CardSelectorProps) {
  const toggleSelected = (id: string) => {
    onSelectedChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  const updateHolderCount = (id: string, delta: number) => {
    const current = holderCounts[id] ?? 1;
    const next = Math.max(1, Math.min(partySize, current + delta));
    onHolderCountsChange?.({ ...holderCounts, [id]: next });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
          {selected.length}/{CREDIT_CARDS.length} selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelectedChange(CREDIT_CARDS.map((c) => c.id))}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            全選
          </button>
          <span className="text-muted-foreground/30 text-[10px]">|</span>
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            清除
          </button>
        </div>
      </div>

      {/* 2-col on sm+, 1-col on mobile */}
      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-3">
        {CREDIT_CARDS.map((card) => (
          <CardBadge
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            holderCount={holderCounts[card.id] ?? 1}
            partySize={partySize}
            sinopacDoublebeiLevel={sinopacDoublebeiLevel}
            onSinopacDoublebeiLevelChange={onSinopacDoublebeiLevelChange}
            isDbsEcoNewUser={isDbsEcoNewUser}
            onDbsEcoNewUserChange={onDbsEcoNewUserChange}
            isSinopacNewUser={isSinopacNewUser}
            onSinopacNewUserChange={onSinopacNewUserChange}
            isUnionJingheNewUser={isUnionJingheNewUser}
            onUnionJingheNewUserChange={onUnionJingheNewUserChange}
            onToggleSelected={() => toggleSelected(card.id)}
            onHolderCountChange={(delta) => updateHolderCount(card.id, delta)}
            engagementSnapshot={engagementSnapshot}
          />
        ))}
      </div>
    </>
  );
}
