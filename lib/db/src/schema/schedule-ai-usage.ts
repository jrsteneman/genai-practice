import {
  bigint,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

export const scheduleAiBudget = pgTable("schedule_ai_budget", {
  scope: text("scope").primaryKey(),
  committedMicros: bigint("committed_micros", { mode: "number" }).notNull(),
});

export const scheduleAiVisitorUsage = pgTable(
  "schedule_ai_visitor_usage",
  {
    day: date("day").notNull(),
    visitor: text("visitor").notNull(),
    requests: integer("requests").notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.visitor] })],
);
