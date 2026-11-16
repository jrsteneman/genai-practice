import assert from "node:assert/strict";
import { test } from "node:test";
import { initialProjects } from "../../schedule-recovery/src/projects";
import { applyProposal } from "../../schedule-recovery/src/proposal";
const project = initialProjects[0];
const context = {
  schedule: { tasks: project.tasks, milestone: project.milestone },
  disruption: project.event,
};
async function post(path: string, body: unknown) {
  return fetch(`http://localhost:80/api/schedule/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("live API returns Cedar Ridge calculated changes", async () => {
  const response = await post("analyze", context);
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.deepEqual(r.changedTaskIds, ["frame", "sheath"]);
  assert.equal(r.afterFinish, 11);
  assert.equal(r.afterMilestone, 10);
  assert.equal(r.mode, "rules-based");
});
test("live question API answers movement directly", async () => {
  const response = await post("question", {
    context,
    question: "Does anything move?",
  });
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.match(r.answer, /^North wing framing moves/);
  assert.match(r.answer, /Overall project finish stays Day 11/);
});
test("live API accepts Concrete Crew A earliest-start paraphrases and reanalysis is idempotent", async () => {
  for (const disruption of [
    "Concrete Crew A cannot start until Day 4",
    "Concrete Crew A can't start before Day 4",
    "Concrete Crew A cannot begin until project Day four",
    "Concrete Crew A available starting Day 4",
  ]) {
    const i = structuredClone({ ...context, disruption });
    const response = await post("analyze", i);
    assert.equal(response.status, 200);
    const r = await response.json();
    assert.equal(r.status, "ready", disruption);
    assert.equal(r.constraints[0].restriction, "start-not-before");
    assert.equal(
      r.changes.find((c: { taskId: string }) => c.taskId === "footings")
        .afterStart,
      4,
    );
    assert.doesNotMatch(r.summary, /^(Yes|No)\./);
    i.schedule.tasks = applyProposal(i.schedule.tasks, r);
    const repeat = await post("analyze", i);
    assert.equal((await repeat.json()).status, "no-impact");
  }
});
test("live API clarifies unknown timing without dates or proposal", async () => {
  const response = await post("analyze", {
    ...context,
    disruption: "Telehandler unavailable for two days",
  });
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.equal(r.status, "clarification");
  assert.equal(r.afterFinish, null);
  assert.deepEqual(r.changes, []);
});
test("live API rejects graph corruption, malformed bodies and blank events", async () => {
  const broken = structuredClone(context);
  broken.schedule.tasks[0].dependencies = ["missing"];
  for (const body of [
    broken,
    {},
    { ...context, disruption: " " },
    { ...context, confirmedTiming: { startDay: 0, confirmed: true } },
  ]) {
    const r = await post("analyze", body);
    assert.equal(r.status, 400);
    assert.equal(typeof (await r.json()).error, "string");
  }
});
test("live API no-impact includes real baseline milestone independently of target", async () => {
  const r = await post("analyze", {
    schedule: {
      tasks: initialProjects[2].tasks,
      milestone: initialProjects[2].milestone,
    },
    disruption: "Coffee delivery delayed until noon",
  });
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.status, "no-impact");
  assert.equal(data.beforeMilestone, 12);
  assert.equal(data.afterMilestone, 12);
  assert.equal(data.milestoneTarget, 11);
});
test("live API preserves accepted interruptions across same and different subsequent events", async () => {
  const i = structuredClone(context);
  i.disruption = "Telehandler unavailable over Days 5–6";
  const r = await post("analyze", i);
  assert.equal(r.status, 200);
  const proposal = await r.json();
  i.schedule.tasks = applyProposal(i.schedule.tasks, proposal);
  assert.equal(i.schedule.tasks.find((t) => t.id === "frame")!.duration, 3);
  const repeat = await post("analyze", i);
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).status, "no-impact");
  i.disruption = "Scissor lift unavailable over Days 4–5";
  const different = await post("analyze", i);
  assert.equal(different.status, 200);
  const next = await different.json();
  assert.deepEqual(next.changedTaskIds, ["interior"]);
  assert.equal(next.afterMilestone, 10);
  assert.equal(next.afterFinish, 11);
});
test("live API retains equipment scope and clarifies partial staffing", async () => {
  const equipment = await post("analyze", {
    ...context,
    disruption:
      "Telehandler unavailable over Days 7–8 affecting North wing framing",
  });
  assert.equal(equipment.status, 200);
  const r = await equipment.json();
  assert.deepEqual(r.changedTaskIds, ["sheath"]);
  assert.equal(r.afterMilestone, 10);
  assert.equal(r.afterFinish, 11);
  const staffing = await post("analyze", {
    ...context,
    disruption:
      "Framing crew North short two carpenters for two days starting Day 4",
  });
  assert.equal(staffing.status, 200);
  const partial = await staffing.json();
  assert.equal(partial.status, "clarification");
  assert.deepEqual(partial.changes, []);
  assert.equal(partial.afterMilestone, null);
  assert.equal(partial.afterFinish, null);
});
