import { Task, WorkerProfile } from "../types";

export interface ValidationPolicy {
  /** Minimum score for a worker to be accepted (0–100). */
  minWorkerScore: number;
  /** Minimum worker success rate (0–1). */
  minSuccessRate: number;
  /** Automatically approve tasks from workers above this score without manual review. */
  autoApproveAboveScore: number;
  /** Automatically reject tasks from workers below this score without manual review. */
  autoRejectBelowScore: number;
}

export interface ValidationResult {
  decision: "approve" | "reject" | "manual_review";
  confidence: number;
  reasoning: string;
  feedback?: string;
}

export interface WorkerEligibility {
  eligible: boolean;
  score: number;
  reasons: string[];
}

const DEFAULT_POLICY: ValidationPolicy = {
  minWorkerScore: 70,
  minSuccessRate: 0.8,
  autoApproveAboveScore: 92,
  autoRejectBelowScore: 40,
};

/**
 * TrustLayer handles worker reputation gating and semi-automated result validation.
 *
 * It does not call external APIs directly — it operates on data already retrieved
 * (WorkerProfile, Task result) to make policy-driven decisions.
 */
export class TrustLayer {
  private policy: ValidationPolicy;

  constructor(policy: Partial<ValidationPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  // ── Worker eligibility ──────────────────────────────────────────────────────

  /**
   * Determine whether a worker meets the policy requirements for a task.
   */
  checkWorkerEligibility(worker: WorkerProfile, taskCategory?: string): WorkerEligibility {
    const reasons: string[] = [];
    let eligible = true;

    if (worker.score < this.policy.minWorkerScore) {
      eligible = false;
      reasons.push(
        `Score ${worker.score} is below minimum required ${this.policy.minWorkerScore}`
      );
    }

    if (worker.successRate < this.policy.minSuccessRate) {
      eligible = false;
      reasons.push(
        `Success rate ${(worker.successRate * 100).toFixed(1)}% is below minimum ${
          (this.policy.minSuccessRate * 100).toFixed(1)
        }%`
      );
    }

    if (
      taskCategory &&
      worker.categories.length > 0 &&
      !worker.categories.includes(taskCategory)
    ) {
      reasons.push(
        `Worker not specialized in category "${taskCategory}" (has: ${worker.categories.join(", ")})`
      );
      // Not a hard block — just a soft warning
    }

    if (eligible && reasons.length === 0) {
      reasons.push(
        `Worker meets all requirements (score: ${worker.score}, success rate: ${(
          worker.successRate * 100
        ).toFixed(1)}%)`
      );
    }

    return { eligible, score: worker.score, reasons };
  }

  // ── Result validation ───────────────────────────────────────────────────────

  /**
   * Semi-automated validation of a submitted task result.
   *
   * Decision logic:
   *  - workerScore ≥ autoApproveAboveScore → auto-approve
   *  - workerScore ≤ autoRejectBelowScore  → auto-reject
   *  - Otherwise                           → send to manual review
   *
   * Pass a custom validator to add content-based checks on top of the score gate.
   */
  validateResult(
    task: Task,
    worker: WorkerProfile,
    contentValidator?: (task: Task) => { pass: boolean; feedback?: string }
  ): ValidationResult {
    if (!task.result) {
      return {
        decision: "reject",
        confidence: 1.0,
        reasoning: "No result was submitted by the worker.",
        feedback: "Please submit your result before marking the task complete.",
      };
    }

    // Content-based check runs first if provided
    if (contentValidator) {
      const { pass, feedback } = contentValidator(task);
      if (!pass) {
        return {
          decision: "reject",
          confidence: 0.9,
          reasoning: "Result failed content validation.",
          feedback,
        };
      }
    }

    if (worker.score >= this.policy.autoApproveAboveScore) {
      return {
        decision: "approve",
        confidence: this.normalizeScore(worker.score),
        reasoning: `Auto-approved: worker score ${worker.score} exceeds auto-approve threshold ${this.policy.autoApproveAboveScore}.`,
      };
    }

    if (worker.score <= this.policy.autoRejectBelowScore) {
      return {
        decision: "reject",
        confidence: 1 - this.normalizeScore(worker.score),
        reasoning: `Auto-rejected: worker score ${worker.score} is below auto-reject threshold ${this.policy.autoRejectBelowScore}.`,
        feedback:
          "Your submission was automatically flagged due to low account reputation. Please review the guidelines.",
      };
    }

    return {
      decision: "manual_review",
      confidence: 0.5,
      reasoning: `Worker score ${worker.score} falls in the manual review band (${this.policy.autoRejectBelowScore}–${this.policy.autoApproveAboveScore}). Human review required.`,
    };
  }

  // ── Score projection ────────────────────────────────────────────────────────

  /**
   * Project the new worker score after a task outcome.
   * Score increases on approval, decreases on rejection.
   */
  projectScoreUpdate(
    currentScore: number,
    decision: "approve" | "reject",
    weight: number = 1.0
  ): number {
    const delta = decision === "approve" ? 2 * weight : -5 * weight;
    return Math.max(0, Math.min(100, Math.round((currentScore + delta) * 10) / 10));
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private normalizeScore(score: number): number {
    return Math.max(0, Math.min(1, score / 100));
  }

  getPolicy(): ValidationPolicy {
    return { ...this.policy };
  }

  updatePolicy(patch: Partial<ValidationPolicy>): void {
    this.policy = { ...this.policy, ...patch };
  }
}
