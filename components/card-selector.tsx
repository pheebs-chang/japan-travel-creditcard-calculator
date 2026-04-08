"use client";

// Card selection component with holder count support
import { Check, BadgeCheck, ExternalLink, Minus, Plus, Users } from "lucide-react";
import { CREDIT_CARDS, CreditCard } from "@/lib/card-data";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

function formatCeiling(rule: CreditCard["cashback"][number]): string | null {
  if (rule.maxSpending == null) return null;
  const amount = new Intl.NumberFormat("zh-TW").format(Math.floor(rule.maxSpending));
  return `${rule.maxSpendingIsApprox ? "約 " : ""}刷卡上限 NT$ ${amount}`;
}

interface CardSelectorProps {
  selected: string[];
  enrolled: string[];
  holderCounts?: Record<string, number>; // cardId -> number of holders in party
  partySize?: number;
  /** 永豐幣倍卡：Level 1 加碼上限 NT$300／月；Level 2 NT$800／月 */
  sinopacDoublebeiLevel?: 1 | 2;
  onSinopacDoublebeiLevelChange?: (level: 1 | 2) => void;
  isDbsEcoNewUser?: boolean;
  onDbsEcoNewUserChange?: (v: boolean) => void;
  isSinopacNewUser?: boolean;
  onSinopacNewUserChange?: (v: boolean) => void;
  isUnionJingheNewUser?: boolean;
  onUnionJingheNewUserChange?: (v: boolean) => void;
  onSelectedChange: (selected: string[]) => void;
  onEnrolledChange: (enrolled: string[]) => void;
  onHolderCountsChange?: (counts: Record<string, number>) => void;
}

function CardBadge({
  card,
  selected,
  enrolled,
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
  onToggleEnrolled,
  onHolderCountChange,
}: {
  card: CreditCard;
  selected: boolean;
  enrolled: boolean;
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
  onToggleEnrolled: () => void;
  onHolderCountChange: (delta: number) => void;
}) {
  const isInverted = selected;

  return (
    <div
      className={cn(
        "relative flex flex-col w-full rounded-xl border transition-all duration-200 overflow-hidden",
        isInverted
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground"
      )}
    >
      {/* Tags row — top right absolute */}
      {card.tags.length > 0 && (
        <div className="absolute top-2.5 right-2.5 flex flex-wrap gap-1 justify-end z-10 max-w-[55%]">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-tight whitespace-nowrap",
                isInverted
                  ? "bg-background/15 text-background"
                  : "bg-secondary border border-border text-muted-foreground"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Main toggle area */}
      <button
        type="button"
        onClick={onToggleSelected}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${card.id}`}
        className="flex-1 w-full text-left p-3 pb-2.5"
      >
        {/* Card name + checkbox — leave space for tags */}
        <div className="flex items-start justify-between gap-2 pr-2">
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold text-sm leading-tight pr-1", isInverted ? "text-background" : "text-foreground")}>
              {card.name}
            </p>
            <p className={cn("text-[11px] mt-0.5", isInverted ? "text-background/55" : "text-muted-foreground")}>
              {card.bank}
            </p>
          </div>
          <div
            className={cn(
              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all mt-0.5",
              isInverted ? "border-background/60 bg-background" : "border-border"
            )}
          >
            {selected && <Check className="h-3 w-3 text-foreground" strokeWidth={3} />}
          </div>
        </div>

        {/* Cashback rates grid — 2 cols */}
        <div className="mt-2.5 grid grid-cols-2 gap-1">
          {card.cashback.map((rule) => (
            <div
              key={rule.category}
              className={cn(
                "rounded-md px-2 py-1.5",
                isInverted ? "bg-background/10" : "bg-secondary"
              )}
            >
              <p className={cn("text-[9px] leading-tight truncate", isInverted ? "text-background/55" : "text-muted-foreground")}>
                {rule.label}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={cn("text-xs font-bold font-mono", isInverted ? "text-background" : "text-foreground")}>
                  {rule.rate}%
                </span>
                {rule.maxSpending !== undefined && (
                  <span className={cn("text-[9px]", isInverted ? "text-background/40" : "text-muted-foreground/60")}>
                    {formatCeiling(rule)}
                  </span>
                )}
              </div>
              {rule.ruleNote && (
                <p className={cn("text-[8px] leading-tight mt-0.5 line-clamp-2", isInverted ? "text-background/35" : "text-muted-foreground/50")}>
                  {rule.ruleNote}
                </p>
              )}
            </div>
          ))}
        </div>

        {card.notes && (
          <p className={cn("mt-2 text-[9px] leading-relaxed line-clamp-2", isInverted ? "text-background/45" : "text-muted-foreground/65")}>
            {card.notes}
          </p>
        )}
      </button>

      {/* Divider */}
      <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />

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
              <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="px-3 py-2.5 flex flex-col gap-2">
                <span className={cn("text-[10px] font-medium", isInverted ? "text-background/70" : "text-muted-foreground")}>
                  會員等級（加碼上限）
                </span>
                <div className="flex gap-1.5">
                  {([1, 2] as const).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSinopacDoublebeiLevelChange(lv);
                      }}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors duration-200",
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
              <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="px-3 py-2 flex items-center justify-between gap-2">
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
              <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="px-3 py-2 flex items-center justify-between gap-2">
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
              <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
              <div className="px-3 py-2 flex items-center justify-between gap-2">
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
          <div className={cn("mx-3 h-px flex-shrink-0", isInverted ? "bg-background/10" : "bg-border")} />
          <div className="flex items-center justify-between px-3 py-2 gap-2">
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

      {/* Bottom row: switch + registration link */}
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BadgeCheck
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              enrolled
                ? isInverted ? "text-background" : "text-foreground"
                : isInverted ? "text-background/30" : "text-muted-foreground/40"
            )}
          />
          <span className={cn(
            "text-[10px] font-medium truncate",
            enrolled
              ? isInverted ? "text-background" : "text-foreground"
              : isInverted ? "text-background/50" : "text-muted-foreground"
          )}>
            已成功登錄
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Registration link */}
          <a
            href={card.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Register ${card.id}`}
            className={cn(
              "flex items-center justify-center h-6 w-6 rounded-md transition-colors",
              isInverted
                ? "text-background/50 hover:bg-background/10 hover:text-background"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
          <Switch
            checked={enrolled}
            onCheckedChange={onToggleEnrolled}
            aria-label={`Enrolled: ${card.id}`}
            className={cn(
              "scale-75 origin-right flex-shrink-0",
              isInverted ? "data-[state=checked]:bg-background" : ""
            )}
          />
        </div>
      </div>
    </div>
  );
}

export function CardSelector({
  selected,
  enrolled,
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
  onEnrolledChange,
  onHolderCountsChange,
}: CardSelectorProps) {
  const toggleSelected = (id: string) => {
    onSelectedChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  const toggleEnrolled = (id: string) => {
    onEnrolledChange(
      enrolled.includes(id) ? enrolled.filter((e) => e !== id) : [...enrolled, id]
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
          {selected.length}/{CREDIT_CARDS.length} selected, {enrolled.length} enrolled
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CREDIT_CARDS.map((card) => (
          <CardBadge
            key={card.id}
            card={card}
            selected={selected.includes(card.id)}
            enrolled={enrolled.includes(card.id)}
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
            onToggleEnrolled={() => toggleEnrolled(card.id)}
            onHolderCountChange={(delta) => updateHolderCount(card.id, delta)}
          />
        ))}
      </div>
    </>
  );
}
