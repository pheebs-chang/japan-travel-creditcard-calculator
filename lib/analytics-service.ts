"use client";

import { getAnalyticsIdentityContext } from "@/lib/analytics";

type EventName =
  | "app_init"
  | "budget_calculated"
  | "card_portfolio_updated"
  | "invalid_micro_adjustment"
  | "cap_limit_triggered"
  | "backup_card_selected"
  | "cta_clicked";

type BrowserWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: Record<string, unknown>[];
  mixpanel?: {
    track?: (event: string, payload?: Record<string, unknown>) => void;
    people?: { set?: (payload: Record<string, unknown>) => void };
  };
};

export interface AppInitEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Is_Scenario_Simulation: boolean;
}

export interface BudgetCalculatedEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Total_Spend: number;
  Flight_Amt: number;
  Hotel_Amt: number;
  Trans_Amt: number;
  Intent_Score_Hotel: number;
  Intent_Score_Trans: number;
  alpha: number;
  N_calc: number;
}

export interface CardPortfolioUpdatedEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Initial_Card_Set: string[];
  Target_Card_Set: string[];
  Delta_Reward: number;
}

export interface InvalidMicroAdjustmentEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Calculation_Count: number;
  Time_Spent: number;
}

export interface CapLimitTriggeredEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Triggered_Cards: string[];
}

export interface BackupCardSelectedEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  Triggered_Cards: string[];
  Added_Cards: string[];
  Seconds_From_Cap_Trigger: number;
}

export interface CtaClickedEvent {
  Anonymous_UID: string;
  Session_ID: string;
  Referral_Source_ID: string;
  CTA_Type: "apply_card" | "register_event";
  Target_Card: string;
  Displayed_Reward: number;
  Registration_Friction_Ratio: number;
}

export const EVENT_SCHEMAS: Record<EventName, Record<string, unknown>> = {
  app_init: {
    type: "object",
    required: ["Anonymous_UID", "Session_ID", "Referral_Source_ID", "Is_Scenario_Simulation"],
    properties: {
      Anonymous_UID: { type: "string" },
      Session_ID: { type: "string" },
      Referral_Source_ID: { type: "string" },
      Is_Scenario_Simulation: { type: "boolean" },
    },
  },
  budget_calculated: {
    type: "object",
    required: [
      "Total_Spend",
      "Flight_Amt",
      "Hotel_Amt",
      "Trans_Amt",
      "Intent_Score_Hotel",
      "Intent_Score_Trans",
      "alpha",
      "N_calc",
    ],
    properties: {
      Total_Spend: { type: "number" },
      Flight_Amt: { type: "number" },
      Hotel_Amt: { type: "number" },
      Trans_Amt: { type: "number" },
      Intent_Score_Hotel: { type: "number", minimum: 0, maximum: 1 },
      Intent_Score_Trans: { type: "number", minimum: 0, maximum: 1 },
      alpha: { type: "number" },
      N_calc: { type: "integer", minimum: 0 },
    },
  },
  card_portfolio_updated: {
    type: "object",
    required: ["Initial_Card_Set", "Target_Card_Set", "Delta_Reward"],
    properties: {
      Initial_Card_Set: { type: "array", items: { type: "string" } },
      Target_Card_Set: { type: "array", items: { type: "string" } },
      Delta_Reward: { type: "number" },
    },
  },
  invalid_micro_adjustment: {
    type: "object",
    required: ["Calculation_Count", "Time_Spent"],
    properties: {
      Calculation_Count: { type: "integer", minimum: 0 },
      Time_Spent: { type: "number", minimum: 0 },
    },
  },
  cap_limit_triggered: {
    type: "object",
    required: ["Triggered_Cards"],
    properties: {
      Triggered_Cards: { type: "array", items: { type: "string" } },
    },
  },
  backup_card_selected: {
    type: "object",
    required: ["Triggered_Cards", "Added_Cards", "Seconds_From_Cap_Trigger"],
    properties: {
      Triggered_Cards: { type: "array", items: { type: "string" } },
      Added_Cards: { type: "array", items: { type: "string" } },
      Seconds_From_Cap_Trigger: { type: "number", minimum: 0 },
    },
  },
  cta_clicked: {
    type: "object",
    required: ["CTA_Type", "Target_Card", "Displayed_Reward", "Registration_Friction_Ratio"],
    properties: {
      CTA_Type: { type: "string", enum: ["apply_card", "register_event"] },
      Target_Card: { type: "string" },
      Displayed_Reward: { type: "number" },
      Registration_Friction_Ratio: { type: "number", minimum: 0, maximum: 1 },
    },
  },
};

function round4(v: number): number {
  return Number(v.toFixed(4));
}

export class AnalyticsService {
  private appStartAt = Date.now();
  private initialCardSet: string[] | null = null;
  private prevCardSet: string[] = [];
  private prevReward = 0;
  private ctaClicked = false;
  private calcCount = 0;
  private microAdjustStreak = 0;
  private lastTotalSpend = 0;
  private invalidDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private capTriggerAt: number | null = null;
  private capTriggeredCards: string[] = [];
  private capConsumed = false;

  private baseIdentity() {
    return getAnalyticsIdentityContext();
  }

  private emit(name: EventName, payload: object) {
    if (typeof window === "undefined") return;
    const w = window as BrowserWindow;
    if (typeof w.gtag === "function") {
      w.gtag("event", name, payload);
    }
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: name, ...(payload as Record<string, unknown>) });
    if (typeof w.mixpanel?.track === "function") {
      w.mixpanel.track(name, payload as Record<string, unknown>);
    }
  }

  trackAppInit(params: { isScenarioSimulation: boolean }) {
    const id = this.baseIdentity();
    const event: AppInitEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      Is_Scenario_Simulation: params.isScenarioSimulation,
    };
    this.emit("app_init", event);
  }

  onBudgetCalculated(params: {
    totalSpend: number;
    flightAmt: number;
    hotelAmt: number;
    transAmt: number;
    alpha: number;
    nCalc: number;
  }) {
    const id = this.baseIdentity();
    const total = Math.max(0, params.totalSpend || 0);
    const intentHotel = total > 0 ? params.hotelAmt / total : 0;
    const intentTrans = total > 0 ? params.transAmt / total : 0;
    const event: BudgetCalculatedEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      Total_Spend: total,
      Flight_Amt: params.flightAmt || 0,
      Hotel_Amt: params.hotelAmt || 0,
      Trans_Amt: params.transAmt || 0,
      Intent_Score_Hotel: round4(intentHotel),
      Intent_Score_Trans: round4(intentTrans),
      alpha: Math.max(0, Math.round(params.alpha || 0)),
      N_calc: Math.max(0, Math.floor(params.nCalc || 0)),
    };
    this.emit("budget_calculated", event);

    if (typeof window !== "undefined") {
      const w = window as BrowserWindow;
      if (typeof w.mixpanel?.people?.set === "function") {
        const tags: Record<string, unknown> = {};
        if (event.Intent_Score_Hotel > 0.4) tags["飯店平台高敏感者"] = true;
        if (event.Intent_Score_Trans > 0.2) tags["Suica/ICOCA 頻繁使用者"] = true;
        if (Object.keys(tags).length > 0) w.mixpanel.people.set(tags);
      }
    }
  }

  onCardPortfolioUpdated(params: {
    targetCardSet: string[];
    rewardNet: number;
  }) {
    if (!this.initialCardSet) this.initialCardSet = [...params.targetCardSet];
    const changed =
      this.prevCardSet.length > 0 &&
      (this.prevCardSet.length !== params.targetCardSet.length ||
        this.prevCardSet.some((id) => !params.targetCardSet.includes(id)));
    if (!changed) {
      this.prevCardSet = [...params.targetCardSet];
      this.prevReward = params.rewardNet;
      return;
    }
    const id = this.baseIdentity();
    const event: CardPortfolioUpdatedEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      Initial_Card_Set: this.initialCardSet ?? [],
      Target_Card_Set: [...params.targetCardSet],
      Delta_Reward: Math.round(params.rewardNet - this.prevReward),
    };
    this.emit("card_portfolio_updated", event);
    this.prevCardSet = [...params.targetCardSet];
    this.prevReward = params.rewardNet;
  }

  onCalculateAttempt(params: { totalSpend: number; clickedFinalCta: boolean }) {
    this.calcCount += 1;
    this.ctaClicked = params.clickedFinalCta ? true : this.ctaClicked;
    const delta = Math.abs((params.totalSpend || 0) - this.lastTotalSpend);
    this.lastTotalSpend = params.totalSpend || 0;
    if (delta < 500) this.microAdjustStreak += 1;
    else this.microAdjustStreak = 0;

    if (!this.ctaClicked && this.microAdjustStreak >= 3) {
      if (this.invalidDebounceTimer) clearTimeout(this.invalidDebounceTimer);
      this.invalidDebounceTimer = setTimeout(() => {
        const id = this.baseIdentity();
        const event: InvalidMicroAdjustmentEvent = {
          Anonymous_UID: id.Anonymous_UID,
          Session_ID: id.Session_ID,
          Referral_Source_ID: id.Referral_Source_ID,
          Calculation_Count: this.calcCount,
          Time_Spent: Math.round((Date.now() - this.appStartAt) / 1000),
        };
        this.emit("invalid_micro_adjustment", event);
      }, 800);
    }
  }

  onCapLimitTriggered(triggeredCards: string[]) {
    const id = this.baseIdentity();
    const event: CapLimitTriggeredEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      Triggered_Cards: triggeredCards,
    };
    this.capTriggerAt = Date.now();
    this.capTriggeredCards = [...triggeredCards];
    this.capConsumed = false;
    this.emit("cap_limit_triggered", event);
  }

  onCardSelectionChanged(selectedCards: string[]) {
    if (!this.capTriggerAt || this.capConsumed) return;
    const elapsedSec = (Date.now() - this.capTriggerAt) / 1000;
    if (elapsedSec > 10) return;
    const addedCards = selectedCards.filter((id) => !this.prevCardSet.includes(id));
    if (addedCards.length === 0) return;
    const id = this.baseIdentity();
    const event: BackupCardSelectedEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      Triggered_Cards: [...this.capTriggeredCards],
      Added_Cards: addedCards,
      Seconds_From_Cap_Trigger: round4(elapsedSec),
    };
    this.capConsumed = true;
    this.emit("backup_card_selected", event);
  }

  onCtaClicked(params: {
    ctaType: "apply_card" | "register_event";
    targetCard: string;
    displayedReward: number;
    registrationFrictionRatio: number;
  }) {
    this.ctaClicked = true;
    const id = this.baseIdentity();
    const event: CtaClickedEvent = {
      Anonymous_UID: id.Anonymous_UID,
      Session_ID: id.Session_ID,
      Referral_Source_ID: id.Referral_Source_ID,
      CTA_Type: params.ctaType,
      Target_Card: params.targetCard,
      Displayed_Reward: Math.round(params.displayedReward || 0),
      Registration_Friction_Ratio: round4(Math.max(0, Math.min(1, params.registrationFrictionRatio || 0))),
    };
    this.emit("cta_clicked", event);
  }

  setPortfolioBaseline(cards: string[], rewardNet: number) {
    if (!this.initialCardSet) this.initialCardSet = [...cards];
    this.prevCardSet = [...cards];
    this.prevReward = rewardNet;
  }

  getCalculationCount(): number {
    return this.calcCount;
  }
}

export const analyticsService = new AnalyticsService();

