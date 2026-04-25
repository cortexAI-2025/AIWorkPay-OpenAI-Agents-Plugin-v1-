export type TaskStatus =
  | "pending"
  | "funded"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "validated"
  | "paid"
  | "disputed";

export type Currency = "USD" | "EUR" | "USDC" | "USDT";

export type PaymentMethod = "wallet" | "stripe" | "crypto";

export interface Task {
  id: string;
  title: string;
  description?: string;
  reward: number;
  currency: Currency;
  category?: string;
  status: TaskStatus;
  workerId?: string;
  workerScore?: number;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  reward: number;
  currency?: Currency;
  category?: string;
  deadline?: string;
  metadata?: Record<string, unknown>;
}

export interface FundTaskParams {
  paymentMethod?: PaymentMethod;
}

export interface AssignWorkerParams {
  workerId?: string;
  minWorkerScore?: number;
}

export interface CompleteTaskParams {
  result: Record<string, unknown>;
  notes?: string;
}

export interface ValidateTaskParams {
  approved?: boolean;
  feedback?: string;
  reassign?: boolean;
}

export interface WorkerProfile {
  id: string;
  score: number;
  completedTasks: number;
  successRate: number;
  categories: string[];
  avgCompletionTimeHours: number;
}

export interface AccountBalance {
  available: number;
  escrowed: number;
  currency: Currency;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  offset: number;
}

export interface TaskListParams {
  status?: TaskStatus;
  category?: string;
  limit?: number;
  offset?: number;
}
