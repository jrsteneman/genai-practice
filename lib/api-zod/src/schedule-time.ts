/** Absolute pause windows are separate from working duration across acceptance. */
export type PauseWindow = { startDay: number; endDay: number };

export function executionDates(
  startDay: number,
  duration: number,
  windows: PauseWindow[] = [],
) {
  // Coalesce first so existing and newly submitted outages cannot count twice.
  const merged: PauseWindow[] = [];
  for (const w of [...windows].sort((a, b) => a.startDay - b.startDay)) {
    const last = merged.at(-1);
    if (last && w.startDay <= last.endDay + 1)
      last.endDay = Math.max(last.endDay, w.endDay);
    else merged.push({ ...w });
  }
  let cursor = startDay,
    remaining = duration,
    first: number | null = null;
  for (const w of merged) {
    if (w.endDay < cursor) continue;
    const available = Math.max(0, w.startDay - cursor);
    if (available > 0 && first === null) first = cursor;
    if (available >= remaining) {
      const finish = cursor + remaining - 1;
      return {
        start: first ?? cursor,
        finish,
        interruptions: merged.filter(
          (p) => p.startDay > (first ?? cursor) && p.endDay < finish,
        ),
      };
    }
    remaining -= available;
    cursor = w.endDay + 1;
  }
  const start = first ?? cursor,
    finish = cursor + remaining - 1;
  return {
    start,
    finish,
    interruptions: merged.filter(
      (w) => w.startDay > start && w.endDay < finish,
    ),
  };
}

export function taskFinish(task: {
  startDay: number;
  duration: number;
  interruptions?: PauseWindow[];
}) {
  return executionDates(task.startDay, task.duration, task.interruptions)
    .finish;
}
