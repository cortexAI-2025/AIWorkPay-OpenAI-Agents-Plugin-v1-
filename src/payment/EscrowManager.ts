import { AiWorkPayTool } from "../tool";
import { Task, Currency, PaymentMethod } from "../types";

export type EscrowStatus = "unfunded" | "escrowed" | "released" | "refunded" | "disputed";

export interface EscrowRecord {
  taskId: string;
  amount: number;
  currency: Currency;
  status: EscrowStatus;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowSummary {
  totalEscrowed: number;
  totalReleased: number;
  totalRefunded: number;
  currency: Currency;
  records: EscrowRecord[];
}

/**
 * EscrowManager wraps the AiWorkPayTool payment operations with a local ledger,
 * status tracking, and helpers for bulk operations.
 *
 * It does not store sensitive payment credentials — those remain with the
 * AiWorkPayTool / API server. The local ledger is in-memory; persist it
 * externally (DB, file) if durability is needed.
 */
export class EscrowManager {
  private ledger = new Map<string, EscrowRecord>();
  private defaultCurrency: Currency;
  private defaultPaymentMethod: PaymentMethod;

  constructor(
    private tool: AiWorkPayTool,
    options: {
      defaultCurrency?: Currency;
      defaultPaymentMethod?: PaymentMethod;
    } = {}
  ) {
    this.defaultCurrency = options.defaultCurrency ?? "USD";
    this.defaultPaymentMethod = options.defaultPaymentMethod ?? "wallet";
  }

  // ── Fund ────────────────────────────────────────────────────────────────────

  /**
   * Fund a task and register it in the local ledger.
   */
  async fund(
    taskId: string,
    amount: number,
    options: {
      currency?: Currency;
      paymentMethod?: PaymentMethod;
    } = {}
  ): Promise<Task> {
    const currency = options.currency ?? this.defaultCurrency;
    const paymentMethod = options.paymentMethod ?? this.defaultPaymentMethod;

    const task = await this.tool.fundTask(taskId, { paymentMethod });

    this.ledger.set(taskId, {
      taskId,
      amount,
      currency,
      status: "escrowed",
      paymentMethod,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return task;
  }

  // ── Release (approve) ───────────────────────────────────────────────────────

  /**
   * Validate the task and release escrow to the worker.
   */
  async release(taskId: string, feedback?: string): Promise<Task> {
    const task = await this.tool.validateTask(taskId, {
      approved: true,
      feedback,
    });

    this.updateRecord(taskId, "released");
    return task;
  }

  // ── Refund (reject) ─────────────────────────────────────────────────────────

  /**
   * Reject the task result. Payment is withheld and optionally reassigned.
   */
  async refund(
    taskId: string,
    options: { feedback?: string; reassign?: boolean } = {}
  ): Promise<Task> {
    const task = await this.tool.validateTask(taskId, {
      approved: false,
      feedback: options.feedback,
      reassign: options.reassign ?? false,
    });

    this.updateRecord(taskId, options.reassign ? "escrowed" : "refunded");
    return task;
  }

  // ── Batch operations ────────────────────────────────────────────────────────

  /**
   * Fund multiple tasks concurrently.
   */
  async fundBatch(
    tasks: Array<{ taskId: string; amount: number; currency?: Currency }>,
    paymentMethod?: PaymentMethod
  ): Promise<Task[]> {
    return Promise.all(
      tasks.map(({ taskId, amount, currency }) =>
        this.fund(taskId, amount, { currency, paymentMethod })
      )
    );
  }

  /**
   * Release payment for multiple tasks concurrently.
   */
  async releaseBatch(taskIds: string[]): Promise<Task[]> {
    return Promise.all(taskIds.map((id) => this.release(id)));
  }

  // ── Ledger queries ──────────────────────────────────────────────────────────

  getRecord(taskId: string): EscrowRecord | undefined {
    return this.ledger.get(taskId);
  }

  getSummary(): EscrowSummary {
    const records = Array.from(this.ledger.values());
    const totals = records.reduce(
      (acc, r) => {
        if (r.status === "escrowed") acc.totalEscrowed += r.amount;
        if (r.status === "released") acc.totalReleased += r.amount;
        if (r.status === "refunded") acc.totalRefunded += r.amount;
        return acc;
      },
      { totalEscrowed: 0, totalReleased: 0, totalRefunded: 0 }
    );

    return { ...totals, currency: this.defaultCurrency, records };
  }

  getByStatus(status: EscrowStatus): EscrowRecord[] {
    return Array.from(this.ledger.values()).filter((r) => r.status === status);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private updateRecord(taskId: string, status: EscrowStatus): void {
    const record = this.ledger.get(taskId);
    if (record) {
      record.status = status;
      record.updatedAt = new Date();
    }
  }
}
