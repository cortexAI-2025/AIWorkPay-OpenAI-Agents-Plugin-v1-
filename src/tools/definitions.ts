/**
 * Tool definitions compatible with:
 *  - OpenAI Agents SDK  (responses.create / chat.completions with tools)
 *  - LangChain          (DynamicStructuredTool / StructuredTool)
 *  - AutoGen            (FunctionTool)
 *  - Any OpenAPI-tools runner
 */

export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export const AIWORKPAY_TOOLS: ToolDefinition[] = [
  {
    name: "create_task",
    description:
      "Create a micro-task that will be executed by a human worker. " +
      "Use this when a task requires human judgment, creativity, real-world knowledge, " +
      "or physical execution that an AI model cannot reliably complete alone. " +
      "Returns a task object with an id required for subsequent operations.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short, actionable task title (max 120 chars)",
        },
        description: {
          type: "string",
          description: "Full task instructions for the human worker",
        },
        reward: {
          type: "number",
          description: "Payment amount in the specified currency",
          minimum: 0.01,
        },
        currency: {
          type: "string",
          description: "Payment currency",
          enum: ["USD", "EUR", "USDC", "USDT"],
          default: "USD",
        },
        category: {
          type: "string",
          description:
            "Task category for routing to specialized workers. " +
            "Examples: data-labeling, transcription, research, moderation, classification",
        },
        deadline: {
          type: "string",
          description: "Task deadline in ISO 8601 format (e.g. 2025-12-31T23:59:00Z)",
        },
      },
      required: ["title", "reward"],
    },
  },

  {
    name: "fund_task",
    description:
      "Lock payment in escrow for a task. Must be called after create_task and before " +
      "the task becomes visible to workers. Payment is only released on successful validation.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID returned by create_task",
        },
        paymentMethod: {
          type: "string",
          description: "Payment source for the escrow deposit",
          enum: ["wallet", "stripe", "crypto"],
          default: "wallet",
        },
      },
      required: ["taskId"],
    },
  },

  {
    name: "assign_worker",
    description:
      "Assign a human worker to a funded task. " +
      "If no workerId is specified, the platform auto-routes to the best available worker " +
      "based on category expertise and reputation score.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to assign a worker to",
        },
        workerId: {
          type: "string",
          description: "Specific worker ID (optional; omit to auto-route)",
        },
        minWorkerScore: {
          type: "number",
          description:
            "Minimum worker reputation score required (0–100). Defaults to 70.",
          minimum: 0,
          maximum: 100,
          default: 70,
        },
      },
      required: ["taskId"],
    },
  },

  {
    name: "get_task",
    description:
      "Retrieve current status and details of a task, including the worker's submitted " +
      "result if the task has been completed.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to retrieve",
        },
      },
      required: ["taskId"],
    },
  },

  {
    name: "validate_task",
    description:
      "Approve or reject a completed task. " +
      "Approving releases escrowed payment to the worker. " +
      "Rejecting withholds payment and can optionally reassign the task to another worker.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "Task ID to validate",
        },
        approved: {
          type: "boolean",
          description:
            "true = approve result and release payment; false = reject result",
          default: true,
        },
        feedback: {
          type: "string",
          description: "Feedback message sent to the worker (especially useful on rejection)",
        },
        reassign: {
          type: "boolean",
          description:
            "Automatically reassign to another worker on rejection (default false)",
          default: false,
        },
      },
      required: ["taskId"],
    },
  },

  {
    name: "list_tasks",
    description:
      "List all tasks for the authenticated account. Supports filtering by status and category.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by task status",
          enum: [
            "pending",
            "funded",
            "assigned",
            "in_progress",
            "submitted",
            "validated",
            "paid",
            "disputed",
          ],
        },
        category: {
          type: "string",
          description: "Filter by task category",
        },
        limit: {
          type: "number",
          description: "Number of results to return (max 100)",
          default: 20,
          maximum: 100,
        },
        offset: {
          type: "number",
          description: "Pagination offset",
          default: 0,
        },
      },
      required: [],
    },
  },

  {
    name: "get_balance",
    description:
      "Get the current account balance and total amount held in escrow.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

/**
 * Returns tool definitions in the OpenAI chat completions "tools" format.
 */
export function toOpenAITools() {
  return AIWORKPAY_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Returns a single tool definition by name.
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return AIWORKPAY_TOOLS.find((t) => t.name === name);
}
