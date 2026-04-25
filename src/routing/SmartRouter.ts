import { CreateTaskParams } from "../types";

export type DelegationVerdict = "delegate" | "handle_locally";

export interface RoutingContext {
  taskDescription: string;
  estimatedComplexity?: "low" | "medium" | "high";
  maxBudget?: number;
  maxDelayMs?: number;
  requiresHumanJudgment?: boolean;
}

export interface RoutingScore {
  verdict: DelegationVerdict;
  confidence: number;
  reasoning: string;
  suggestedCategory?: string;
  estimatedCostUSD?: number;
  estimatedDelayMs?: number;
}

/**
 * Criteria weights used to compute the delegation score.
 * Adjust these to tune the router's sensitivity.
 */
const WEIGHTS = {
  requiresPhysicalWorld: 1.0,
  requiresSubjectiveJudgment: 0.9,
  requiresVerifiedHumanIdentity: 0.9,
  aiFailureRisk: 0.8,
  costEfficiency: 0.5,
};

interface TaskSignals {
  requiresPhysicalWorld: boolean;
  requiresSubjectiveJudgment: boolean;
  requiresVerifiedHumanIdentity: boolean;
  aiFailureRisk: "low" | "medium" | "high";
  estimatedCostUSD: number;
}

// Keyword patterns that strongly suggest human delegation is needed
const HUMAN_SIGNALS: RegExp[] = [
  /\b(classify|label|annotate|tag|rate|rank)\b/i,
  /\b(transcri(be|ption)|caption|subtitle)\b/i,
  /\b(moderat(e|ion)|review|audit)\b/i,
  /\b(research|find|locate|verify|confirm)\b/i,
  /\b(creative|write|draft|design|draw)\b/i,
  /\b(physical|real.world|on.site|in.person)\b/i,
  /\b(opinion|sentiment|subjective|qualitative)\b/i,
  /\b(legal|compliance|regulatory|certified)\b/i,
];

const CATEGORY_MAP: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(classify|label|annotate|tag)\b/i, category: "data-labeling" },
  { pattern: /\b(transcri(be|ption)|caption)\b/i, category: "transcription" },
  { pattern: /\b(moderat(e|ion)|nsfw|spam)\b/i, category: "moderation" },
  { pattern: /\b(research|find|locate|verify)\b/i, category: "research" },
  { pattern: /\b(creative|write|draft|copywrite)\b/i, category: "creative-writing" },
  { pattern: /\b(design|ui|ux|mockup|sketch)\b/i, category: "design" },
  { pattern: /\b(translate|translation|locali[sz]e)\b/i, category: "translation" },
  { pattern: /\b(data.entr(y|ies)|fill|form)\b/i, category: "data-entry" },
  { pattern: /\b(survey|feedback|opinion|rating)\b/i, category: "survey" },
];

export class SmartRouter {
  /**
   * Analyse a task and decide whether to delegate to a human worker.
   *
   * @param context  Description and constraints for the task
   * @returns        Routing verdict with reasoning and suggested parameters
   */
  evaluate(context: RoutingContext): RoutingScore {
    const signals = this.extractSignals(context);
    const score = this.computeScore(signals, context);
    const verdict: DelegationVerdict = score >= 0.5 ? "delegate" : "handle_locally";

    return {
      verdict,
      confidence: Math.round(score * 100) / 100,
      reasoning: this.buildReasoning(signals, verdict),
      suggestedCategory: this.inferCategory(context.taskDescription),
      estimatedCostUSD: signals.estimatedCostUSD,
      estimatedDelayMs: this.estimateDelay(context),
    };
  }

  /**
   * Given a task description, return suggested CreateTaskParams fields.
   */
  suggest(context: RoutingContext): Partial<CreateTaskParams> {
    const result = this.evaluate(context);
    return {
      category: result.suggestedCategory,
      reward: result.estimatedCostUSD ?? 5,
      description: context.taskDescription,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private extractSignals(context: RoutingContext): TaskSignals {
    const desc = context.taskDescription.toLowerCase();
    const humanSignalCount = HUMAN_SIGNALS.filter((r) => r.test(desc)).length;

    return {
      requiresPhysicalWorld:
        /physical|real.world|on.site|in.person|location/.test(desc),
      requiresSubjectiveJudgment:
        context.requiresHumanJudgment === true ||
        /opinion|subjective|qualitative|creative|sentiment/.test(desc),
      requiresVerifiedHumanIdentity:
        /legal|certified|compliance|notariz|witnessed/.test(desc),
      aiFailureRisk:
        humanSignalCount >= 3 ? "high" : humanSignalCount >= 1 ? "medium" : "low",
      estimatedCostUSD: this.estimateCost(context),
    };
  }

  private computeScore(signals: TaskSignals, context: RoutingContext): number {
    let score = 0;

    if (signals.requiresPhysicalWorld) score += WEIGHTS.requiresPhysicalWorld;
    if (signals.requiresSubjectiveJudgment) score += WEIGHTS.requiresSubjectiveJudgment;
    if (signals.requiresVerifiedHumanIdentity)
      score += WEIGHTS.requiresVerifiedHumanIdentity;

    const riskScore =
      signals.aiFailureRisk === "high"
        ? 1.0
        : signals.aiFailureRisk === "medium"
        ? 0.5
        : 0.0;
    score += riskScore * WEIGHTS.aiFailureRisk;

    const maxScore =
      WEIGHTS.requiresPhysicalWorld +
      WEIGHTS.requiresSubjectiveJudgment +
      WEIGHTS.requiresVerifiedHumanIdentity +
      WEIGHTS.aiFailureRisk;

    return Math.min(score / maxScore, 1);
  }

  private buildReasoning(signals: TaskSignals, verdict: DelegationVerdict): string {
    const reasons: string[] = [];
    if (signals.requiresPhysicalWorld) reasons.push("requires physical-world access");
    if (signals.requiresSubjectiveJudgment) reasons.push("requires subjective judgment");
    if (signals.requiresVerifiedHumanIdentity)
      reasons.push("requires verified human identity");
    if (signals.aiFailureRisk === "high") reasons.push("high AI failure risk");
    else if (signals.aiFailureRisk === "medium") reasons.push("medium AI failure risk");

    if (verdict === "delegate") {
      return `Delegating to human worker: ${reasons.join(", ") || "task is better suited for a human"}.`;
    }
    return "Handling locally: no strong signals requiring human delegation.";
  }

  private inferCategory(description: string): string | undefined {
    for (const { pattern, category } of CATEGORY_MAP) {
      if (pattern.test(description)) return category;
    }
    return undefined;
  }

  private estimateCost(context: RoutingContext): number {
    if (context.maxBudget) return Math.min(context.maxBudget, 50);
    const complexity = context.estimatedComplexity ?? "medium";
    return complexity === "low" ? 2 : complexity === "medium" ? 10 : 30;
  }

  private estimateDelay(context: RoutingContext): number {
    if (context.maxDelayMs) return context.maxDelayMs;
    const complexity = context.estimatedComplexity ?? "medium";
    // minutes → ms: low=15min, medium=60min, high=240min
    return complexity === "low" ? 900_000 : complexity === "medium" ? 3_600_000 : 14_400_000;
  }
}
