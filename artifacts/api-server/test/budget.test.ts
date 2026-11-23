import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { pool } from "@workspace/db";
import app from "../src/app";
import { maxCost } from "../src/lib/schedule-ai-budget";
import { initialProjects } from "../../schedule-recovery/src/projects";

const project = initialProjects[0];
const context = {
  schedule: { tasks: project.tasks, milestone: project.milestone },
  disruption: project.event,
};
const question = { context, question: "Does anything move?" };
const interpretationCost = maxCost(2200);
const questionCost = interpretationCost + maxCost(450);
const mockUsageCost = 100 + 8 * 20;
let api: Server, model: Server, modelCalls: number[];
let provider: "normal" | "hold" | "unknown" | "invalid";
let releaseModel: () => void;
let modelEntered: Promise<void>;

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}
const close = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
let base: string;

before(async () => {
  model = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const limit = data.max_completion_tokens;
    modelCalls.push(limit);
    if (provider === "hold") {
      await new Promise<void>((resolve) => {
        releaseModel = resolve;
        signalEntered();
      });
    }
    const content =
      limit === 2200
        ? provider === "invalid"
          ? "not JSON"
          : '{"status":"no-impact","items":[]}'
        : "Review the calculated dates.";
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content } }],
        ...(provider === "unknown"
          ? {}
          : {
              usage: { prompt_tokens: 100, completion_tokens: 20 },
            }),
      }),
    );
  });
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = await listen(model);
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "local-test-only";
  api = createServer(app);
  base = await listen(api);
});

let signalEntered: () => void;
beforeEach(async () => {
  await pool.query(
    "DELETE FROM schedule_ai_budget; DELETE FROM schedule_ai_visitor_usage",
  );
  delete process.env.SCHEDULE_AI_BUDGET_MICRO_USD;
  delete process.env.SCHEDULE_AI_VISITOR_DAILY_LIMIT;
  modelCalls = [];
  provider = "normal";
  modelEntered = new Promise<void>((resolve) => {
    signalEntered = resolve;
  });
});

after(async () => {
  await Promise.all([close(api), close(model), pool.end()]);
});

async function post(path: string, body: unknown, forwarded = "198.51.100.10") {
  const response = await fetch(`${base}/api/schedule/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwarded,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
async function committed() {
  const { rows } = await pool.query(
    "SELECT committed_micros FROM schedule_ai_budget",
  );
  return Number(rows[0]?.committed_micros ?? 0);
}

test("a disabled or misconfigured budget fails closed", async () => {
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = "0";
  assert.equal((await post("analyze", context)).status, 429);
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = "invalid";
  assert.equal((await post("question", question)).status, 503);
  assert.deepEqual(modelCalls, []);
  assert.equal(await committed(), 0);
});

test("an unaffordable question uses neither model call", async () => {
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = String(interpretationCost);
  const result = await post("question", question);
  assert.equal(result.status, 429);
  assert.match(result.body.error, /spending limit/);
  assert.deepEqual(modelCalls, []);
  assert.equal(await committed(), 0);

  assert.equal((await post("analyze", context)).status, 200);
  assert.deepEqual(modelCalls, [2200]);
  assert.equal(await committed(), mockUsageCost);
});

test("question uses two bounded model calls and settles both from one reservation", async () => {
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = String(questionCost);
  process.env.SCHEDULE_AI_VISITOR_DAILY_LIMIT = "1";
  assert.equal((await post("question", question)).status, 200);
  assert.deepEqual(modelCalls, [2200, 450]);
  assert.equal(await committed(), mockUsageCost * 2);
  assert.equal((await post("analyze", context)).status, 429);
  assert.deepEqual(modelCalls, [2200, 450]);
});

test("one visitor cannot bypass its daily limit with leftmost forwarded addresses or IP spelling", async () => {
  process.env.SCHEDULE_AI_VISITOR_DAILY_LIMIT = "1";
  assert.equal((await post("analyze", context)).status, 200);
  const blocked = await post(
    "question",
    question,
    "198.51.100.99, ::ffff:198.51.100.10",
  );
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /daily/);
  assert.deepEqual(modelCalls, [2200]);
  assert.equal(await committed(), mockUsageCost);
  assert.equal((await post("analyze", context, "2001:db8::1")).status, 200);
  assert.equal((await post("analyze", context, "2001:db8::2")).status, 429);
  assert.equal((await post("analyze", context, "2001:db8:0:1::1")).status, 200);
  assert.deepEqual(modelCalls, [2200, 2200, 2200]);
});

test("an in-flight reservation blocks another visitor before either question call", async () => {
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = String(questionCost);
  provider = "hold";
  const first = post("question", question);
  await modelEntered;
  try {
    assert.equal(await committed(), questionCost);
    const second = await post("question", question, "198.51.100.20");
    assert.equal(second.status, 429);
    assert.match(second.body.error, /spending limit/);
    assert.deepEqual(modelCalls, [2200]);
    const { rows } = await pool.query(
      "SELECT requests FROM schedule_ai_visitor_usage",
    );
    assert.deepEqual(rows, [{ requests: 1 }]);
  } finally {
    provider = "normal";
    releaseModel();
    assert.equal((await first).status, 200);
  }
  assert.deepEqual(modelCalls, [2200, 450]);
});

test("uncertain usage retains the full attempted charge; an unused second step is released", async () => {
  provider = "unknown";
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = String(interpretationCost);
  assert.equal((await post("analyze", context)).status, 200);
  assert.equal(await committed(), interpretationCost);
  assert.equal((await post("analyze", context, "198.51.100.20")).status, 429);
  assert.deepEqual(modelCalls, [2200]);

  provider = "invalid";
  process.env.SCHEDULE_AI_BUDGET_MICRO_USD = String(
    interpretationCost + questionCost,
  );
  assert.equal((await post("question", question)).status, 503);
  assert.equal(await committed(), interpretationCost + mockUsageCost);
  assert.deepEqual(modelCalls, [2200, 2200]);
});

test("invalid inputs and unavailable budget storage never reach the model", async () => {
  assert.equal((await post("analyze", {})).status, 400);
  const broken = structuredClone(question);
  broken.context.schedule.tasks[0].dependencies = ["missing"];
  assert.equal((await post("question", broken)).status, 400);
  assert.equal(await committed(), 0);
  await pool.query(
    "ALTER TABLE schedule_ai_visitor_usage RENAME TO offline_visitor_usage",
  );
  try {
    for (const [route, body] of [
      ["analyze", context],
      ["question", question],
    ] as const) {
      const result = await post(route, body);
      assert.equal(result.status, 503);
      assert.match(result.body.error, /usage limits could not be checked/);
    }
    assert.deepEqual(modelCalls, []);
    assert.equal(await committed(), 0);
  } finally {
    await pool.query(
      "ALTER TABLE offline_visitor_usage RENAME TO schedule_ai_visitor_usage",
    );
  }
});
