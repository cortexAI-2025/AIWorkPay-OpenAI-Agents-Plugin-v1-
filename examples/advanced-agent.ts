/**
 * Advanced agent example — uses SmartRouter, TrustLayer, and EscrowManager
 * to implement a fully autonomous human-AI hybrid pipeline.
 *
 * Flow:
 *  1. SmartRouter decides whether to delegate each task
 *  2. EscrowManager handles funding
 *  3. TrustLayer validates the worker and the submitted result
 *  4. Payment is released or withheld based on trust decision
 */

import { AiWorkPayTool, SmartRouter, TrustLayer, EscrowManager } from "../src";

const TASKS = [
  {
    description: "Classify 200 product images as defective or non-defective",
    complexity: "medium" as const,
    maxBudget: 20,
  },
  {
    description: "Write a Python script to sort a list",
    complexity: "low" as const,
    maxBudget: 5,
  },
  {
    description: "Transcribe a 30-minute legal deposition audio file",
    complexity: "high" as const,
    maxBudget: 50,
  },
  {
    description: "Generate a regex to match email addresses",
    complexity: "low" as const,
    maxBudget: 2,
  },
];

async function main() {
  const apiKey = process.env.AIWORKPAY_API_KEY ?? "";

  const tool = new AiWorkPayTool(apiKey);
  const router = new SmartRouter();
  const trust = new TrustLayer({ minWorkerScore: 72, autoApproveAboveScore: 90 });
  const escrow = new EscrowManager(tool, { defaultCurrency: "USD" });

  for (const input of TASKS) {
    console.log(`\n── Evaluating: "${input.description}"`);

    // ── Step 1: Route ──────────────────────────────────────────────────────
    const routing = router.evaluate({
      taskDescription: input.description,
      estimatedComplexity: input.complexity,
      maxBudget: input.maxBudget,
    });

    console.log(`   Verdict: ${routing.verdict} (confidence: ${routing.confidence})`);
    console.log(`   Reason : ${routing.reasoning}`);

    if (routing.verdict === "handle_locally") {
      console.log("   → Handled by AI locally. Skipping human delegation.");
      continue;
    }

    // ── Step 2: Create + fund ──────────────────────────────────────────────
    const task = await tool.createTask({
      title: input.description.slice(0, 100),
      description: input.description,
      reward: routing.estimatedCostUSD ?? input.maxBudget,
      category: routing.suggestedCategory,
    });

    console.log(`   Task created: ${task.id}`);

    await escrow.fund(task.id, task.reward, { currency: "USD" });
    console.log(`   Escrowed $${task.reward}`);

    // ── Step 3: Assign with trust-filtered minimum score ───────────────────
    const minScore = trust.getPolicy().minWorkerScore;
    const assigned = await tool.assignWorker(task.id, { minWorkerScore: minScore });
    console.log(`   Worker assigned: ${assigned.workerId} (score: ${assigned.workerScore})`);

    // ── Step 4: Poll for submission ────────────────────────────────────────
    let current = await tool.getTask(task.id);
    let waited = 0;
    const maxWaitMs = routing.estimatedDelayMs ?? 3_600_000;

    while (current.status !== "submitted" && waited < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 15_000));
      waited += 15_000;
      current = await tool.getTask(task.id);
    }

    if (current.status !== "submitted") {
      console.log("   Worker did not submit in time. Skipping validation.");
      continue;
    }

    // ── Step 5: Trust validation ───────────────────────────────────────────
    const worker = await tool.getWorker(assigned.workerId!);
    const eligibility = trust.checkWorkerEligibility(worker, routing.suggestedCategory);

    const validationResult = trust.validateResult(current, worker);
    console.log(`   Validation: ${validationResult.decision} (confidence: ${validationResult.confidence})`);
    console.log(`   Reason    : ${validationResult.reasoning}`);

    if (validationResult.decision === "approve") {
      await escrow.release(task.id);
      console.log(`   Payment released to worker.`);
    } else if (validationResult.decision === "reject") {
      await escrow.refund(task.id, {
        feedback: validationResult.feedback,
        reassign: true,
      });
      console.log(`   Payment withheld. Task reassigned.`);
    } else {
      console.log(`   Flagged for manual review — human operator will decide.`);
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  const summary = escrow.getSummary();
  console.log(`\n══ Escrow Summary ══`);
  console.log(`  Escrowed : $${summary.totalEscrowed}`);
  console.log(`  Released : $${summary.totalReleased}`);
  console.log(`  Refunded : $${summary.totalRefunded}`);
  console.log(`  Currency : ${summary.currency}`);
}

main().catch(console.error);
