import { isIP } from "node:net";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export class ScheduleModelUnavailable extends Error {}
export class ScheduleAiLimitReached extends Error {}

const scope = "public-schedule-ai";
const dailyDefault = 50;
const budgetDefault = 5_000_000;

// USD microdollars per token ($1/$8 per million), intentionally above the
// managed gpt-5-mini rates. Ignore discounts. Recheck on model/rate changes.
const inputRate = 1;
const outputRate = 8;
const inputTokenCeiling = 400_000; // gpt-5-mini context window

export const maxCost = (completionTokens: number) =>
  inputTokenCeiling * inputRate + completionTokens * outputRate;

export function reportedCost(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
  completionLimit: number,
) {
  const input = usage?.prompt_tokens;
  const output = usage?.completion_tokens;
  if (
    typeof input !== "number" ||
    !Number.isSafeInteger(input) ||
    input <= 0 ||
    input > inputTokenCeiling ||
    typeof output !== "number" ||
    !Number.isSafeInteger(output) ||
    output < 0 ||
    output > completionLimit
  ) {
    return maxCost(completionLimit);
  }
  return input * inputRate + output * outputRate;
}

function setting(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new ScheduleModelUnavailable(
      "Schedule AI limits are not configured correctly.",
    );
  }
  return value;
}

export async function reserveScheduleAi(
  visitorIp: string | undefined,
  micros: number,
) {
  const budget = setting(
    "SCHEDULE_AI_BUDGET_MICRO_USD",
    budgetDefault,
    0,
    1e12,
  );
  const daily = setting(
    "SCHEDULE_AI_VISITOR_DAILY_LIMIT",
    dailyDefault,
    0,
    1e6,
  );
  if (micros > budget)
    throw new ScheduleAiLimitReached(
      "The project’s Schedule AI spending limit has been reached.",
    );
  if (!daily)
    throw new ScheduleAiLimitReached(
      "Schedule AI is not accepting visitor requests.",
    );
  if (!visitorIp || !isIP(visitorIp))
    throw new ScheduleModelUnavailable(
      "Schedule AI could not identify this visitor’s network.",
    );

  try {
    const { db, scheduleAiBudget, scheduleAiVisitorUsage } =
      await import("@workspace/db");
    const ip = sql`${visitorIp}::inet`;
    const network = sql`CASE
      WHEN ${ip} <<= '::ffff:0.0.0.0/96'::inet
        THEN '0.0.0.0'::inet + (${ip} - '::ffff:0.0.0.0'::inet)
      WHEN family(${ip}) = 6 THEN network(set_masklen(${ip}, 64))::inet
      ELSE ${ip}
    END`;
    await db.transaction(async (tx) => {
      // A guarded upsert locks the single project row. Both counters commit
      // together, so a remote worker cannot spend against the same capacity.
      const project = await tx
        .insert(scheduleAiBudget)
        .values({ scope, committedMicros: micros })
        .onConflictDoUpdate({
          target: scheduleAiBudget.scope,
          set: {
            committedMicros: sql`${scheduleAiBudget.committedMicros} + ${micros}`,
          },
          setWhere: sql`${scheduleAiBudget.committedMicros} <= ${budget - micros}`,
        })
        .returning({ scope: scheduleAiBudget.scope });
      if (!project.length)
        throw new ScheduleAiLimitReached(
          "The project’s Schedule AI spending limit has been reached or is temporarily reserved by other requests.",
        );

      const visitor = await tx
        .insert(scheduleAiVisitorUsage)
        .values({
          day: sql`(statement_timestamp() AT TIME ZONE 'UTC')::date`,
          visitor: sql`encode(sha256(convert_to((${network})::text, 'UTF8')), 'hex')`,
          requests: 1,
        })
        .onConflictDoUpdate({
          target: [scheduleAiVisitorUsage.day, scheduleAiVisitorUsage.visitor],
          set: { requests: sql`${scheduleAiVisitorUsage.requests} + 1` },
          setWhere: sql`${scheduleAiVisitorUsage.requests} < ${daily}`,
        })
        .returning({ requests: scheduleAiVisitorUsage.requests });
      if (!visitor.length)
        throw new ScheduleAiLimitReached(
          "This network’s daily Schedule AI limit has been reached. Try again after midnight UTC.",
        );
    });

    return async (cost: number) => {
      if (cost >= micros) return;
      // Do not retry a refund: a database disconnect might hide a committed
      // update. Keeping too much reserved is safer than refunding twice.
      try {
        await db
          .update(scheduleAiBudget)
          .set({
            committedMicros: sql`${scheduleAiBudget.committedMicros} - ${micros - cost}`,
          })
          .where(eq(scheduleAiBudget.scope, scope));
      } catch {
        logger.error(
          "Could not settle Schedule AI reservation; full reservation may be retained",
        );
      }
    };
  } catch (error) {
    if (error instanceof ScheduleAiLimitReached) throw error;
    logger.error("Could not reserve Schedule AI budget");
    throw new ScheduleModelUnavailable(
      "Schedule AI is unavailable because its usage limits could not be checked.",
    );
  }
}
