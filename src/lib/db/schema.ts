import {
  pgTable,
  text,
  timestamp,
  uuid,
  decimal,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Auth.js tables
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").notNull().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// Application tables
export const onboardingProfiles = pgTable("onboarding_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  loanBalance: decimal("loan_balance", { precision: 12, scale: 2 }).notNull(),
  currentRate: decimal("current_rate", { precision: 5, scale: 4 }).notNull(),
  remainingTermMonths: integer("remaining_term_months").notNull(),
  expectedTimeInHomeYears: integer("expected_time_in_home_years").notNull(),
  closingCostDollars: decimal("closing_cost_dollars", {
    precision: 10,
    scale: 2,
  }),
  closingCostPercent: decimal("closing_cost_percent", {
    precision: 5,
    scale: 4,
  }),
  // Alert thresholds
  benchmarkRateThreshold: decimal("benchmark_rate_threshold", {
    precision: 5,
    scale: 4,
  }),
  breakEvenMonthsThreshold: integer("break_even_months_threshold"),
  emailAlertsEnabled: boolean("email_alerts_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type MonitorSessionStatus =
  | "active"
  | "paused"
  | "completed"
  | "stopped"
  | "error";

export const monitorSessions = pgTable(
  "monitor_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<MonitorSessionStatus>().default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    lastCheckAt: timestamp("last_check_at", { mode: "date" }),
    lastSuccessAt: timestamp("last_success_at", { mode: "date" }),
    lastError: text("last_error"),
    cooldownUntil: timestamp("cooldown_until", { mode: "date" }),
    thresholdVersion: integer("threshold_version").default(1).notNull(),
    activeWorkflowId: text("active_workflow_id"),
    triggerMetadata: jsonb("trigger_metadata"),
  },
  (table) => [index("monitor_sessions_user_id_idx").on(table.userId)]
);

export const rateSnapshots = pgTable(
  "rate_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    series: text("series").notNull(),
    snapshotDate: timestamp("snapshot_date", { mode: "date" }).notNull(),
    value: decimal("value", { precision: 5, scale: 4 }).notNull(),
    fetchedAt: timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rate_snapshots_series_date_idx").on(
      table.series,
      table.snapshotDate
    ),
  ]
);

export const evaluationRuns = pgTable(
  "evaluation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => monitorSessions.id, { onDelete: "cascade" }),
    ranAt: timestamp("ran_at", { mode: "date" }).defaultNow().notNull(),
    outcome: text("outcome").$type<"triggered" | "not_triggered" | "error">().notNull(),
    computedMetrics: jsonb("computed_metrics"),
    triggeredReason: text("triggered_reason"),
    notifiedAt: timestamp("notified_at", { mode: "date" }),
  },
  (table) => [index("evaluation_runs_session_id_idx").on(table.sessionId)]
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => monitorSessions.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull().unique(),
    sentAt: timestamp("sent_at", { mode: "date" }).defaultNow().notNull(),
    subject: text("subject").notNull(),
    bodyPreview: text("body_preview"),
    emailId: text("email_id"),
  },
  (table) => [
    index("alert_events_session_id_idx").on(table.sessionId),
    uniqueIndex("alert_events_dedupe_key_idx").on(table.dedupeKey),
  ]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(onboardingProfiles, {
    fields: [users.id],
    references: [onboardingProfiles.userId],
  }),
  sessions: many(monitorSessions),
  accounts: many(accounts),
}));

export const onboardingProfilesRelations = relations(
  onboardingProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [onboardingProfiles.userId],
      references: [users.id],
    }),
  })
);

export const monitorSessionsRelations = relations(
  monitorSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [monitorSessions.userId],
      references: [users.id],
    }),
    evaluationRuns: many(evaluationRuns),
    alertEvents: many(alertEvents),
  })
);

export const evaluationRunsRelations = relations(evaluationRuns, ({ one }) => ({
  session: one(monitorSessions, {
    fields: [evaluationRuns.sessionId],
    references: [monitorSessions.id],
  }),
}));

export const alertEventsRelations = relations(alertEvents, ({ one }) => ({
  session: one(monitorSessions, {
    fields: [alertEvents.sessionId],
    references: [monitorSessions.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
export type NewOnboardingProfile = typeof onboardingProfiles.$inferInsert;
export type MonitorSession = typeof monitorSessions.$inferSelect;
export type NewMonitorSession = typeof monitorSessions.$inferInsert;
export type RateSnapshot = typeof rateSnapshots.$inferSelect;
export type NewRateSnapshot = typeof rateSnapshots.$inferInsert;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type NewEvaluationRun = typeof evaluationRuns.$inferInsert;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;
