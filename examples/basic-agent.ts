/**
 * Basic agent example — full task lifecycle:
 * create → fund → assign → poll → validate
 */

import { AiWorkPayTool } from "../src";

async function main() {
  const aiworkpay = new AiWorkPayTool(process.env.AIWORKPAY_API_KEY ?? "");

  // 1. Create task
  const task = await aiworkpay.createTask({
    title: "Classify 50 horse race entries",
    description:
      "For each of the 50 rows in the attached CSV, classify the entry as " +
      "'favourite', 'outsider', or 'unknown' based on the provided odds and " +
      "past-performance columns. Return a JSON array with {id, classification}.",
    reward: 10,
    currency: "USD",
    category: "data-labeling",
  });

  console.log(`Task created: ${task.id} (status: ${task.status})`);

  // 2. Fund (locks payment in escrow)
  await aiworkpay.fundTask(task.id);
  console.log("Task funded — payment in escrow.");

  // 3. Assign (auto-routes to best available worker)
  await aiworkpay.assignWorker(task.id, { minWorkerScore: 75 });
  console.log("Worker assigned.");

  // 4. Poll until the worker submits
  let current = await aiworkpay.getTask(task.id);
  while (current.status !== "submitted" && current.status !== "validated") {
    console.log(`Waiting for worker… (current status: ${current.status})`);
    await new Promise((r) => setTimeout(r, 10_000));
    current = await aiworkpay.getTask(task.id);
  }

  console.log("Worker submitted result:", JSON.stringify(current.result, null, 2));

  // 5. Validate and release payment
  await aiworkpay.validateTask(task.id, { approved: true });
  console.log("Task validated — payment released to worker.");
}

main().catch(console.error);
