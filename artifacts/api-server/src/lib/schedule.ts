import { isDeepStrictEqual } from "node:util";
import type {
  AnalysisInput,
  ScheduleAnalysis,
  HoldConstraint,
  ScheduleSnapshot,
} from "@workspace/api-zod";
import {
  AnalyzeScheduleResponse,
  executionDates,
  taskFinish,
  type PauseWindow,
} from "@workspace/api-zod";

export const modeDetail =
  "Rules-based schedule calculation.";
const convention =
  "An earliest start of Day 4 permits starting on Day 4; it is not a four-day delay or an interruption. Project days are inclusive: a hold on Days 4–5 releases at the start of Day 6. Work pauses during overlapping holds and resumes afterward. Task duration remains working days; accepted pause windows are stored separately from elapsed start-to-finish spans. Finish-to-start dependencies begin no earlier than the next day. No resource-capacity leveling or calendar inference.";
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const has = (s: string, phrase: string) =>
  ` ${norm(s)} `.includes(` ${norm(phrase)} `);
const words: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};
export function numberWords(s: string) {
  return s
    .toLowerCase()
    .replace(
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)(?:[ -]+(?:one|two|three|four|five|six|seven|eight|nine|hundred))?\b/g,
      (m) => {
        let n = 0;
        for (const w of m.split(/[ -]+/))
          n = w === "hundred" ? n * 100 : n + words[w];
        return String(n);
      },
    );
}
export function validateGraph(s: ScheduleSnapshot) {
  if (
    s.tasks.some(
      (t) =>
        ![t.id, t.name, t.crew, t.equipment].every((v) => v.trim().length > 0),
    ) ||
    !s.milestone.name.trim()
  )
    throw new Error(
      "Task identifiers, names, resources, and milestone names cannot be blank.",
    );
  const map = new Map(s.tasks.map((t) => [t.id, t]));
  if (map.size !== s.tasks.length) throw new Error("Task IDs must be unique.");
  for (const t of s.tasks) {
    if (t.interruptions?.some((w) => w.endDay < w.startDay))
      throw new Error(`Invalid interruption window on ${t.name}.`);
    if (
      executionDates(t.startDay, t.duration, t.interruptions).start !==
      t.startDay
    )
      throw new Error(
        `${t.name} cannot start inside an accepted interruption. Correct its start or pause window.`,
      );
  }
  const visited = new Set<string>(),
    visiting = new Set<string>(),
    order: string[] = [];
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Dependency cycle detected.");
    if (visited.has(id)) return;
    const t = map.get(id);
    if (!t) throw new Error(`Unknown dependency or milestone task: ${id}.`);
    visiting.add(id);
    if (new Set(t.dependencies).size !== t.dependencies.length)
      throw new Error(`Duplicate dependencies on ${t.name}.`);
    for (const dep of t.dependencies) {
      visit(dep);
      const parent = map.get(dep)!;
      if (taskFinish(parent) >= t.startDay)
        throw new Error(
          `${t.name} starts before dependency ${parent.name} finishes. Correct the baseline.`,
        );
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }
  s.tasks.forEach((t) => visit(t.id));
  if (new Set(s.milestone.taskIds).size !== s.milestone.taskIds.length)
    throw new Error("Milestone task IDs must be unique.");
  s.milestone.taskIds.forEach((id) => {
    if (!map.has(id)) throw new Error(`Unknown milestone task: ${id}.`);
  });
  return order;
}

export function interpret(input: AnalysisInput) {
  const constraints: HoldConstraint[] = [],
    clarifications: string[] = [],
    assumptions: string[] = [];
  const { tasks } = input.schedule;
  const equipment = [...new Set(tasks.map((t) => t.equipment))];
  const crews = [...new Set(tasks.map((t) => t.crew))];
  const negatedTargets = new Set<string>();
  if (
    /\b(ignore|override|instructions?|pretend|system prompt)\b/i.test(
      input.disruption,
    ) ||
    /\bday\s*[-−]\s*\d|\b\d+\.\d+\b/i.test(numberWords(input.disruption))
  )
    return {
      constraints,
      assumptions,
      clarifications: [
        "Describe only a scheduling restriction with whole positive project days; instructions cannot override schedule validation.",
      ],
    };
  // Split independent named constraints, but keep "between Day 4 and Day 5" intact.
  const clauses = input.disruption
    .split(/[;,.!?\n]+|\b(?:and|but|while|plus)\b(?=\s+(?:the\s+)?[a-z])/i)
    .filter((s) => s.trim());
  for (const clause of clauses) {
    const text = numberWords(clause)
      .replace(/[’']/g, "'")
      .replace(/\bcan'?t\b/g, "cannot")
      .replace(/\bwon't\b/g, "will not")
      .replace(/(\d)-day/g, "$1 day")
      .replace(/\s+/g, " ")
      .trim();
    // Match an asserted start, not an outage's "starting on Day ..." modifier.
    // The strict subject/tail checks below still reject uncertainty and negation.
    const positiveStarts = [
      ...text.matchAll(
        /\b(?:starts|begins|will\s+(?:start|begin)|is\s+(?:starting|beginning))\s+(?:on\s+)?(?:project\s+)?day\s+(\d+)\b/g,
      ),
    ];
    const earliestMatches = [
      ...text.matchAll(
        /\b(?:(?:cannot|can not|will not|may not)\s+(?:start|begin)\s+(?:until|before)|(?:not|no)\s+(?:start(?:ing)?|begin(?:ning)?)\s+before|available\s+(?:starting|from))\s+(?:project\s+)?day\s+(\d+)\b/g,
      ),
      ...positiveStarts,
    ].sort((a, b) => a.index! - b.index!);
    const earliestDay = earliestMatches.length
      ? Number(earliestMatches[0][1])
      : null;
    if (
      earliestDay === null &&
      /\b(until|through)\s+(?:project\s+)?day\s+\d+\b/i.test(text) &&
      !/\bdays?\s+\d+\s*(?:[-–—]|through|to|and)\s*(?:day\s*)?\d+\b/.test(text)
    ) {
      clarifications.push(
        "Use an inclusive project-day window such as Days 4–5 instead of an ambiguous release or end day.",
      );
      continue;
    }
    const negative =
      /\b(not|never|no longer|isn['’]t|is not|won['’]t|will not)\s+(?:be\s+|on\s+|a\s+|an\s+)*(?:down|unavailable|held|hold|out|delayed|broken|outage)\b/i.test(
        clause,
      ) || /\bno\s+(?:equipment\s+)?(?:outage|hold|delay)\b/i.test(clause);
    if (negative && !positiveStarts.length) {
      [...equipment, ...crews, ...tasks.map((t) => t.name)]
        .filter((name) => has(clause, name))
        .forEach((name) => negatedTargets.add(name));
      continue;
    }
    const disruption =
      /\b(hold|held|unavailable|down|outage|broken|delay|delayed|stop|pause|offline|inspection|short|shortage|absent)\b/i.test(
        clause,
      );
    const knownMention = tasks.some(
      (t) =>
        has(clause, t.name) || has(clause, t.equipment) || has(clause, t.crew),
    );
    if (
      /\b(coffee|lunch|snack|catering|break.room)\b/i.test(clause) &&
      !knownMention &&
      !/\b(lift|telehandler|crane|equipment|machine|crew|framing|excavator|pump|forklift)\b/i.test(
        clause,
      )
    )
      continue;
    if (!disruption && earliestDay === null) {
      if (!/\b(coffee|lunch|snack|catering|break.room)\b/i.test(clause))
        clarifications.push(
          'Name a listed task, crew, or equipment with a clear start restriction such as “Form crew B starts on Day 3”, or provide a full project-day outage window.',
        );
      continue;
    }
    if (
      /\b(short|shortage|understaffed|absent|sick|fewer|missing)\b|\bdown\s+\d+\s+(?:carpenters?|workers?|people|operators?)\b/.test(
        text,
      )
    ) {
      clarifications.push(
        "A partial staffing shortage does not establish a full work stoppage. Confirm whether a specific task or the entire crew must stop, with an explicit hold window; reduced staffing productivity is not modeled.",
      );
      continue;
    }
    if (
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        text,
      ) &&
      !input.confirmedTiming
    ) {
      clarifications.push(
        "Map relative or calendar timing to an explicit project-day start; yearless dates are not inferred.",
      );
      continue;
    }
    let targets: {
      kind: HoldConstraint["kind"];
      target: string;
      taskIds: string[];
    }[] = [];
    const namedTasks = tasks.filter(
      (t) => has(clause, t.name) || has(clause, t.name.split(" · ")[0]),
    );
    const exact = equipment.filter((e) => has(clause, e));
    const exactCrews = crews.filter((c) => has(clause, c));
    const explicitOutage = (name: string) =>
      new RegExp(
        `\\b${norm(name).replace(/ /g, "\\s+")}\\s+(?:(?:is|will|be|on|a|an|the)\\s+)*(?:unavailable|down|broken|offline|outage|held|hold)\\b`,
      ).test(norm(clause)) ||
      (earliestDay !== null &&
        new RegExp(
          `\\b${norm(name).replace(/ /g, "\\s+")}\\s+(?:(?:is|will|be|the)\\s+)*(?:cannot|can t|can not|will not|may not|available|starts|begins|start|begin|starting|beginning)\\b`,
        ).test(norm(text)));
    const outageEquipment = exact.filter(explicitOutage);
    const outageCrews = exactCrews.filter(explicitOutage);
    if (namedTasks.length && (outageEquipment.length || outageCrews.length)) {
      // A task mentioned as an effect does not narrow an explicit resource-wide outage.
      targets = [
        ...outageEquipment.map((e) => ({
          kind: "equipment" as const,
          target: e,
          taskIds: tasks.filter((t) => t.equipment === e).map((t) => t.id),
        })),
        ...outageCrews.map((c) => ({
          kind: "crew" as const,
          target: c,
          taskIds: tasks.filter((t) => t.crew === c).map((t) => t.id),
        })),
      ];
    } else if (namedTasks.length && (exact.length || exactCrews.length)) {
      clarifications.push(
        "Both a task and a resource are named. State whether only the task is held or the named equipment/entire crew is unavailable for all assigned work.",
      );
      continue;
    } else if (namedTasks.length)
      targets = namedTasks.map((t) => ({
        kind: "task",
        target: t.name,
        taskIds: [t.id],
      }));
    else {
      targets = [
        ...exact.map((e) => ({
          kind: "equipment" as const,
          target: e,
          taskIds: tasks.filter((t) => t.equipment === e).map((t) => t.id),
        })),
        ...exactCrews.map((c) => ({
          kind: "crew" as const,
          target: c,
          taskIds: tasks.filter((t) => t.crew === c).map((t) => t.id),
        })),
      ];
      if (!targets.length) {
        const generic = equipment.filter((e) =>
          norm(clause)
            .split(" ")
            .some((w) => w.length > 3 && norm(e).split(" ").includes(w)),
        );
        clarifications.push(
          generic.length
            ? `Specify exact equipment: ${generic.join(", ")}. A generic lift or machine is ambiguous.`
            : "The named resource or task is not identified in this schedule. Use its exact listed name.",
        );
        continue;
      }
    }
    if (earliestDay !== null) {
      const days = [...text.matchAll(/\bday\s+(\d+)\b/g)].map((m) =>
        Number(m[1]),
      );
      const matched = earliestMatches[0];
      const prefix = norm(text.slice(0, matched.index!));
      const tail = text.slice(matched.index! + matched[0].length).trim();
      const targetNames = targets.flatMap((target) => [
        norm(numberWords(target.target)),
        ...(target.kind === "task"
          ? [norm(numberWords(target.target.split(" · ")[0]))]
          : []),
      ]);
      // A keyword match is not enough: "not available", "might be available",
      // and "no longer cannot start" reverse or weaken the asserted restriction.
      const explicitSubject = targetNames.some((name) =>
        [name, `the ${name}`].some((subject) =>
          [subject, `${subject} is`, `${subject} will be`].includes(prefix),
        ),
      );
      const effect = tail.match(/^affecting\s+(.+)$/);
      const knownEffect =
        effect && tasks.some((t) => norm(effect[1]) === norm(t.name));
      if (
        earliestMatches.length !== 1 ||
        days.some((d) => d !== earliestDay) ||
        earliestDay < 1 ||
        earliestDay > 10000 ||
        !explicitSubject ||
        (tail && !knownEffect) ||
        targets.length !== 1 ||
        (input.confirmedTiming &&
          input.confirmedTiming.startDay !== earliestDay)
      ) {
        clarifications.push(
          "Provide one definite, non-negated earliest-start project day (1–10000) for one exact task or resource. Exact-date overrides are not supported. Separate outages from start restrictions and resolve conflicting timing.",
        );
        continue;
      }
      assumptions.push(
        `${targets[0].target}: availability begins on Day ${earliestDay} (inclusive earliest start). Work may begin on Day ${earliestDay} or later; baseline dates and dependencies still govern actual starts, and existing later starts are not pulled forward. This is not a guaranteed exact start, an interruption, or extra working duration.`,
      );
      constraints.push({
        ...targets[0],
        restriction: "start-not-before",
        earliestStartDay: earliestDay,
        duration: null,
        startDay: null,
        endDay: null,
        releaseDay: earliestDay,
      });
      continue;
    }
    const durations = [...text.matchAll(/\b(\d+)\s*[- ]?\s*days?\b/g)].map(
      (m) => Number(m[1]),
    );
    const window = text.match(
      /\bdays?\s+(\d+)\s*(?:[-–—]|through|to|and)\s*(?:day\s*)?(\d+)\b/,
    );
    const windows = [
      ...text.matchAll(
        /\bdays?\s+(\d+)\s*(?:[-–—]|through|to|and)\s*(?:day\s*)?(\d+)\b/g,
      ),
    ];
    const startDays = [
      ...text.matchAll(
        /\b(?:starting|from|on|beginning)\s+(?:project\s+)?day\s+(\d+)\b/g,
      ),
    ].map((m) => Number(m[1]));
    if (windows.length > 1 || new Set(startDays).size > 1) {
      clarifications.push(
        "Multiple or contradictory windows: separate each named hold with a semicolon and one start/window.",
      );
      continue;
    }
    const start =
      text.match(
        /\b(?:starting|from|on|beginning|start(?:s|ing)?(?: on)?)\s+(?:project\s+)?day\s+(\d+)\b/,
      ) ?? text.match(/\bday\s+(\d+)\b/);
    const explicitStart = window
      ? Number(window[1])
      : start
        ? Number(start[1])
        : null;
    const duration = window
      ? Number(window[2]) - Number(window[1]) + 1
      : durations[0];
    if (window && startDays.some((d) => d !== Number(window[1]))) {
      clarifications.push(
        "The stated hold start conflicts with its inclusive window. Confirm one consistent window.",
      );
      continue;
    }
    if (
      durations.some((d) => d !== duration) ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      duration > 1000
    ) {
      clarifications.push(
        "Provide one consistent positive hold duration (up to 1000 project days) per named constraint.",
      );
      continue;
    }
    if (
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|until noon)\b/i.test(
        clause,
      ) &&
      !input.confirmedTiming
    ) {
      clarifications.push(
        "Map relative or calendar timing to an explicit project-day start; yearless dates are not inferred.",
      );
    }
    if (
      input.confirmedTiming &&
      explicitStart !== null &&
      explicitStart !== input.confirmedTiming.startDay
    ) {
      clarifications.push(
        "Confirmed start contradicts the disruption's explicit project day. Correct one before applying.",
      );
      continue;
    }
    const startDay = explicitStart ?? input.confirmedTiming?.startDay ?? null;
    if (
      startDay !== null &&
      (!Number.isInteger(startDay) || startDay < 1 || startDay > 10000)
    ) {
      clarifications.push(
        "Hold start must be a positive project day up to 10000.",
      );
      continue;
    }
    if (startDay === null)
      clarifications.push(
        "When does this hold start? Enter and explicitly confirm a project-day start, or add a window such as Days 4–5.",
      );
    else if (explicitStart === null)
      assumptions.push(
        `Foreman confirmed project Day ${startDay} as the hold start; no calendar date inferred.`,
      );
    for (const target of targets)
      constraints.push({
        ...target,
        restriction: "outage",
        earliestStartDay: null,
        duration,
        startDay,
        endDay: startDay === null ? null : startDay + duration - 1,
        releaseDay: startDay === null ? null : startDay + duration,
      });
  }
  if (constraints.some((c) => negatedTargets.has(c.target)))
    clarifications.push(
      "The same resource/task is described as both unavailable and not unavailable. Resolve the contradiction before applying.",
    );
  for (const c of constraints.filter(
    (c) => c.restriction === "start-not-before",
  )) {
    if (negatedTargets.has(c.target))
      clarifications.push(
        "Resolve conflicting availability and earliest-start statements before applying.",
      );
    if (
      constraints.some(
        (other) =>
          other !== c &&
          other.taskIds.some((id) => c.taskIds.includes(id)) &&
          other.restriction === "start-not-before" &&
          other.earliestStartDay !== c.earliestStartDay,
      )
    )
      clarifications.push(
        "Conflicting earliest-start days name the same work. Confirm one earliest-start day before applying.",
      );
  }
  return {
    constraints,
    clarifications: [...new Set(clarifications)],
    assumptions: [...new Set(assumptions)],
  };
}

// Interpreter boundary: neither a future model nor an API caller can supply dates.
// Validate shape, then require exact input-grounded evidence, including scope and
// clarifications. Unsupported language stays a clarification, never a guessed hold.
const interpretationSchema = AnalyzeScheduleResponse.pick({
  constraints: true,
  assumptions: true,
  clarifications: true,
});
export function validateInterpretation(
  input: AnalysisInput,
  candidate: unknown,
) {
  const parsed = interpretationSchema.strict().parse(candidate);
  const evidence = interpret(input);
  if (
    !isDeepStrictEqual(candidate, parsed) ||
    !isDeepStrictEqual(parsed, {
      constraints: evidence.constraints,
      assumptions: evidence.assumptions,
      clarifications: evidence.clarifications,
    })
  )
    throw new Error(
      "Interpretation lacks exact input-grounded target, scope, or timing evidence.",
    );
  return parsed;
}

export function analyze(input: AnalysisInput): ScheduleAnalysis {
  if (!input.disruption.trim())
    throw new Error("Describe the disruption before analyzing.");
  const interpretation = validateInterpretation(input, interpret(input));
  return calculate(input, interpretation);
}

export function calculate(
  input: AnalysisInput,
  interpretation: ReturnType<typeof validateInterpretation>,
  provenance: Pick<ScheduleAnalysis, "mode" | "modeDetail"> = {
    mode: "rules-based",
    modeDetail,
  },
): ScheduleAnalysis {
  const order = validateGraph(input.schedule);
  const { tasks, milestone } = input.schedule;
  const finish = (
    ids: string[],
    dates: Map<string, { start: number; finish: number }>,
  ) => Math.max(...ids.map((id) => dates.get(id)!.finish));
  const baseline = new Map(
    tasks.map((t) => [t.id, { start: t.startDay, finish: taskFinish(t) }]),
  );
  const beforeFinish = finish(
      tasks.map((t) => t.id),
      baseline,
    ),
    beforeMilestone = finish(milestone.taskIds, baseline);
  const common = {
    ...interpretation,
    ...provenance,
    convention,
    beforeFinish,
    beforeMilestone,
    milestoneName: milestone.name,
    milestoneTarget: milestone.targetDay,
  };
  if (interpretation.clarifications.length)
    return {
      ...common,
      status: "clarification",
      summary:
        "Cannot determine schedule movement yet. Clarify the resource and timing before any changes can be applied.",
      changes: [],
      changedTaskIds: [],
      affectedTaskIds: [],
      afterFinish: null,
      afterMilestone: null,
    };
  const result = new Map<
      string,
      { start: number; finish: number; interruptions: PauseWindow[] }
    >(),
    affected = new Set<string>();
  for (const id of order) {
    const t = tasks.find((t) => t.id === id)!;
    const holds = interpretation.constraints.filter((c) =>
      c.taskIds.includes(id),
    );
    const directOverlap = holds.some((c) =>
      c.restriction === "start-not-before"
        ? t.startDay < c.earliestStartDay!
        : c.startDay! <= baseline.get(id)!.finish && c.endDay! >= t.startDay,
    );
    if (directOverlap || t.dependencies.some((d) => affected.has(d)))
      affected.add(id);
    const earliest = Math.max(
      t.startDay,
      ...holds
        .filter((c) => c.restriction === "start-not-before")
        .map((c) => c.earliestStartDay!),
      ...t.dependencies.map((d) => result.get(d)!.finish + 1),
    );
    result.set(
      id,
      executionDates(earliest, t.duration, [
        ...(t.interruptions ?? []),
        ...holds
          .filter((c) => c.restriction === "outage")
          .map((c) => ({ startDay: c.startDay!, endDay: c.endDay! })),
      ]),
    );
  }
  const changes = tasks.flatMap((t) => {
    const after = result.get(t.id)!,
      before = baseline.get(t.id)!;
    return after.start === before.start && after.finish === before.finish
      ? []
      : [
          {
            taskId: t.id,
            name: t.name,
            beforeStart: before.start,
            beforeFinish: before.finish,
            afterStart: after.start,
            afterFinish: after.finish,
            afterDuration: t.duration,
            afterInterruptions: after.interruptions,
          },
        ];
  });
  const afterFinish = finish(
      tasks.map((t) => t.id),
      result,
    ),
    afterMilestone = finish(milestone.taskIds, result);
  const movement = changes.length
    ? `${changes.map((c) => `${c.name} moves from Days ${c.beforeStart}–${c.beforeFinish} to Days ${c.afterStart}–${c.afterFinish}`).join("; ")}.`
    : "No task dates move.";
  const milestoneText = `${milestone.name} completion ${afterMilestone === beforeMilestone ? `stays Day ${beforeMilestone}` : `moves from Day ${beforeMilestone} to Day ${afterMilestone}`} (target Day ${milestone.targetDay}).`;
  const finishText = `Overall project finish ${afterFinish === beforeFinish ? `stays Day ${beforeFinish}` : `moves from Day ${beforeFinish} to Day ${afterFinish}`}.`;
  const unchanged = tasks
    .filter((t) => !changes.some((c) => c.taskId === t.id))
    .map((t) => t.name);
  return {
    ...common,
    status: changes.length ? "ready" : "no-impact",
    summary: `${movement} ${milestoneText} ${finishText} ${unchanged.length ? `Unchanged: ${unchanged.join("; ")}. ` : ""}Only explicit start restrictions, overlapping holds, and finish-to-start dependencies move work; available float is retained.`,
    changes,
    changedTaskIds: changes.map((c) => c.taskId),
    affectedTaskIds: [...affected],
    afterFinish,
    afterMilestone,
  };
}

export function answer(input: AnalysisInput, question: string) {
  const result = analyze(input);
  const detail =
    result.status === "clarification"
      ? result.clarifications.join(" ")
      : /\b(alternative|instead|crew transfer|substitut)/i.test(question)
        ? "No alternate equipment, crew transfer, resource-capacity leveling, or safety approval is modeled."
        : result.convention;
  return {
    answer: `${result.summary} ${detail}`,
    mode: result.mode,
    modeDetail,
  };
}
