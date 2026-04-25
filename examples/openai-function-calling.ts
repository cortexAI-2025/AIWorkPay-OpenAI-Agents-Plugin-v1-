/**
 * OpenAI chat completions with function calling — AiWorkPay tools wired in.
 *
 * The model decides when to delegate a task to a human worker.
 * The dispatcher executes the chosen tool and feeds the result back.
 *
 * Prerequisites:
 *   OPENAI_API_KEY=...
 *   AIWORKPAY_API_KEY=...
 */

import OpenAI from "openai";
import { AiWorkPayTool, toOpenAITools } from "../src";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const aiworkpay = new AiWorkPayTool(process.env.AIWORKPAY_API_KEY ?? "");

const tools = toOpenAITools();

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "create_task":
      return aiworkpay.createTask(args as Parameters<typeof aiworkpay.createTask>[0]);

    case "fund_task":
      return aiworkpay.fundTask(args.taskId as string);

    case "assign_worker":
      return aiworkpay.assignWorker(args.taskId as string, {
        minWorkerScore: args.minWorkerScore as number | undefined,
      });

    case "get_task":
      return aiworkpay.getTask(args.taskId as string);

    case "validate_task":
      return aiworkpay.validateTask(args.taskId as string, {
        approved: args.approved as boolean | undefined,
        feedback: args.feedback as string | undefined,
        reassign: args.reassign as boolean | undefined,
      });

    case "list_tasks":
      return aiworkpay.listTasks(args as Parameters<typeof aiworkpay.listTasks>[0]);

    case "get_balance":
      return aiworkpay.getBalance();

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function runAgent(userMessage: string) {
  console.log(`User: ${userMessage}\n`);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an autonomous agent that can delegate micro-tasks to human workers " +
        "via AiWorkPay. When a task requires human judgment, creativity, or real-world " +
        "execution, use the available tools to create, fund, assign, and validate the task.",
    },
    { role: "user", content: userMessage },
  ];

  // Agentic loop
  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    messages.push(choice.message);

    if (choice.finish_reason === "stop") {
      console.log(`Agent: ${choice.message.content}`);
      break;
    }

    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
      for (const call of choice.message.tool_calls) {
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        console.log(`→ Calling ${call.function.name}(${JSON.stringify(args)})`);

        const result = await dispatch(call.function.name, args);
        console.log(`← Result: ${JSON.stringify(result, null, 2)}\n`);

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
  }
}

// Example invocation
runAgent(
  "I need 100 product images classified as 'defective' or 'non-defective'. " +
    "Budget is $15. Please handle this end-to-end."
).catch(console.error);
