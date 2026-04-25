import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  Task,
  TaskListResponse,
  WorkerProfile,
  AccountBalance,
  CreateTaskParams,
  FundTaskParams,
  AssignWorkerParams,
  CompleteTaskParams,
  ValidateTaskParams,
  TaskListParams,
} from "./types";

const DEFAULT_BASE_URL = "https://api.aiworkpay.com";

export class AiWorkPayTool {
  private client: AxiosInstance;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  // ── Task lifecycle ──────────────────────────────────────────────────────────

  async createTask(params: CreateTaskParams): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.post("/tasks", params);
    return res.data;
  }

  async listTasks(params: TaskListParams = {}): Promise<TaskListResponse> {
    const res: AxiosResponse<TaskListResponse> = await this.client.get("/tasks", {
      params,
    });
    return res.data;
  }

  async getTask(taskId: string): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.get(`/tasks/${taskId}`);
    return res.data;
  }

  async fundTask(taskId: string, params: FundTaskParams = {}): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.post(
      `/tasks/${taskId}/fund`,
      params
    );
    return res.data;
  }

  async assignWorker(taskId: string, params: AssignWorkerParams = {}): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.post(
      `/tasks/${taskId}/assign`,
      params
    );
    return res.data;
  }

  async completeTask(taskId: string, params: CompleteTaskParams): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.post(
      `/tasks/${taskId}/complete`,
      params
    );
    return res.data;
  }

  async validateTask(
    taskId: string,
    params: ValidateTaskParams = { approved: true }
  ): Promise<Task> {
    const res: AxiosResponse<Task> = await this.client.post(
      `/tasks/${taskId}/validate`,
      params
    );
    return res.data;
  }

  // ── Workers ─────────────────────────────────────────────────────────────────

  async getWorker(workerId: string): Promise<WorkerProfile> {
    const res: AxiosResponse<WorkerProfile> = await this.client.get(
      `/workers/${workerId}`
    );
    return res.data;
  }

  // ── Account ─────────────────────────────────────────────────────────────────

  async getBalance(): Promise<AccountBalance> {
    const res: AxiosResponse<AccountBalance> = await this.client.get(
      "/account/balance"
    );
    return res.data;
  }

  // ── Convenience: full task lifecycle in one call ────────────────────────────

  async delegateAndPay(
    params: CreateTaskParams,
    options: {
      paymentMethod?: FundTaskParams["paymentMethod"];
      minWorkerScore?: number;
      pollIntervalMs?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<Task> {
    const { paymentMethod, minWorkerScore, pollIntervalMs = 5000, timeoutMs = 300_000 } =
      options;

    const task = await this.createTask(params);
    await this.fundTask(task.id, { paymentMethod });
    await this.assignWorker(task.id, { minWorkerScore });

    return this.pollUntilSubmitted(task.id, pollIntervalMs, timeoutMs);
  }

  private async pollUntilSubmitted(
    taskId: string,
    intervalMs: number,
    timeoutMs: number
  ): Promise<Task> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const task = await this.getTask(taskId);
      if (task.status === "submitted" || task.status === "validated") {
        return task;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(`Task ${taskId} timed out waiting for worker submission`);
  }
}
