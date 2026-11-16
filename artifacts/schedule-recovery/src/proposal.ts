import type {
  ProjectTask,
  ScheduleAnalysis,
} from "@workspace/api-client-react";
import { taskFinish } from "@workspace/api-zod";

export function applyProposal<T extends ProjectTask>(
  tasks: T[],
  proposal: ScheduleAnalysis,
): T[] {
  if (proposal.status !== "ready" || !proposal.changes.length)
    throw new Error("No confirmed task changes to apply.");
  for (const c of proposal.changes) {
    const t = tasks.find((t) => t.id === c.taskId);
    if (!t || t.startDay !== c.beforeStart || taskFinish(t) !== c.beforeFinish)
      throw new Error("Schedule changed. Analyze again before applying.");
  }
  return tasks.map((t) => {
    const c = proposal.changes.find((c) => c.taskId === t.id);
    return c
      ? {
          ...t,
          startDay: c.afterStart,
          duration: c.afterDuration,
          interruptions: c.afterInterruptions,
        }
      : t;
  });
}
