import { db, monitorSessions, evaluationRuns, users, onboardingProfiles } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import type { MonitorSessionStatus } from "@/lib/db/schema";
import { fetchAndStoreLatestRate, RATE_SERIES } from "./rates";
import { sendRefinanceAlert, type RefinanceAlertData } from "./email";
import { evaluateRefinanceTriggers, profileToCalcInput } from "./refinance-calc";

const WORKFLOW_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Creates a new monitor session for a user
 */
export async function createMonitorSession(userId: string): Promise<string> {
  const result = await db
    .insert(monitorSessions)
    .values({
      userId,
      status: "active",
    })
    .returning({ id: monitorSessions.id });

  return result[0].id;
}

/**
 * Gets the current (most recent) monitor session for a user
 */
export async function getCurrentSession(userId: string) {
  const result = await db
    .select()
    .from(monitorSessions)
    .where(eq(monitorSessions.userId, userId))
    .orderBy(desc(monitorSessions.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Gets a session by ID
 */
export async function getSessionById(sessionId: string) {
  const result = await db
    .select()
    .from(monitorSessions)
    .where(eq(monitorSessions.id, sessionId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Updates session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: MonitorSessionStatus,
  additionalFields?: {
    completedAt?: Date;
    lastError?: string;
    triggerMetadata?: Record<string, unknown>;
    activeWorkflowId?: string;
  }
) {
  await db
    .update(monitorSessions)
    .set({
      status,
      ...additionalFields,
    })
    .where(eq(monitorSessions.id, sessionId));
}

/**
 * Pause a session
 */
export async function pauseSession(sessionId: string) {
  await updateSessionStatus(sessionId, "paused");
}

/**
 * Resume a paused session
 */
export async function resumeSession(sessionId: string) {
  const session = await getSessionById(sessionId);
  if (!session || session.status !== "paused") {
    throw new Error("Session cannot be resumed");
  }

  await updateSessionStatus(sessionId, "active");

  // Trigger a new workflow run
  await triggerWorkflowRun(sessionId);
}

/**
 * Stop a session permanently
 */
export async function stopSession(sessionId: string) {
  await updateSessionStatus(sessionId, "stopped");
}

/**
 * Start over - creates a new session for the user
 */
export async function startOver(userId: string): Promise<string> {
  // Mark any existing active sessions as stopped
  await db
    .update(monitorSessions)
    .set({ status: "stopped" })
    .where(
      and(
        eq(monitorSessions.userId, userId),
        eq(monitorSessions.status, "active")
      )
    );

  // Create new session
  const sessionId = await createMonitorSession(userId);

  // Trigger workflow
  await triggerWorkflowRun(sessionId);

  return sessionId;
}

/**
 * Triggers a durable workflow run for a session
 */
export async function triggerWorkflowRun(sessionId: string): Promise<void> {
  // Update session to mark workflow as starting
  await db
    .update(monitorSessions)
    .set({ activeWorkflowId: `workflow-${sessionId}` })
    .where(eq(monitorSessions.id, sessionId));

  // Call the workflow API endpoint (uses Vercel Workflow DevKit)
  try {
    await fetch(`${WORKFLOW_BASE_URL}/api/workflow/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });
  } catch (error) {
    console.error("Failed to trigger workflow:", error);
  }
}

/**
 * Run now - immediate evaluation
 */
export async function runNow(sessionId: string): Promise<{
  triggered: boolean;
  metrics: Record<string, unknown>;
}> {
  const result = await runEvaluation(sessionId, true);
  return result;
}

/**
 * Records an evaluation run
 */
export async function recordEvaluationRun(params: {
  sessionId: string;
  outcome: "triggered" | "not_triggered" | "error";
  computedMetrics?: Record<string, unknown>;
  triggeredReason?: string;
  notifiedAt?: Date;
}) {
  await db.insert(evaluationRuns).values({
    sessionId: params.sessionId,
    outcome: params.outcome,
    computedMetrics: params.computedMetrics,
    triggeredReason: params.triggeredReason,
    notifiedAt: params.notifiedAt,
  });
}

/**
 * Gets evaluation history for a session
 */
export async function getEvaluationHistory(sessionId: string) {
  return db
    .select()
    .from(evaluationRuns)
    .where(eq(evaluationRuns.sessionId, sessionId))
    .orderBy(desc(evaluationRuns.ranAt));
}

/**
 * Main evaluation logic - runs the check and potentially sends alert
 */
export async function runEvaluation(
  sessionId: string,
  bypassCooldown = false
): Promise<{
  triggered: boolean;
  metrics: Record<string, unknown>;
}> {
  // Get session with user and profile
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  // Check session status
  if (session.status !== "active") {
    return { triggered: false, metrics: { skipped: true, reason: session.status } };
  }

  // Get user profile
  const profileResult = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, session.userId))
    .limit(1);

  const profile = profileResult[0];
  if (!profile) {
    throw new Error("Profile not found");
  }

  // Get user email
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = userResult[0];
  if (!user) {
    throw new Error("User not found");
  }

  // Fetch latest rate
  const rateData = await fetchAndStoreLatestRate();
  if (!rateData) {
    await recordEvaluationRun({
      sessionId,
      outcome: "error",
      computedMetrics: { error: "Failed to fetch rate data" },
    });
    await updateSessionStatus(sessionId, "error", {
      lastError: "Failed to fetch rate data",
    });
    return { triggered: false, metrics: { error: "Failed to fetch rate data" } };
  }

  // Update last check time
  await db
    .update(monitorSessions)
    .set({
      lastCheckAt: new Date(),
      lastSuccessAt: new Date(),
    })
    .where(eq(monitorSessions.id, sessionId));

  // Evaluate thresholds
  const evaluation = evaluateRefinanceTriggers(
    profileToCalcInput(profile),
    rateData.value
  );

  if (!evaluation.triggered) {
    await recordEvaluationRun({
      sessionId,
      outcome: "not_triggered",
      computedMetrics: evaluation.metrics as unknown as Record<string, unknown>,
    });
    return { triggered: false, metrics: evaluation.metrics as unknown as Record<string, unknown> };
  }

  // Trigger! Send alert if email is enabled
  if (profile.emailAlertsEnabled) {
    const alertData: RefinanceAlertData = {
      userName: user.name || "there",
      currentRate: evaluation.metrics.currentRate,
      benchmarkRate: rateData.value,
      benchmarkRateThreshold: profile.benchmarkRateThreshold
        ? parseFloat(profile.benchmarkRateThreshold)
        : undefined,
      estimatedNewRate: evaluation.metrics.estimatedNewRate,
      monthlySavings: evaluation.metrics.monthlySavings,
      breakEvenMonths: evaluation.metrics.breakEvenMonths ?? 0,
      breakEvenThreshold: profile.breakEvenMonthsThreshold ?? undefined,
      triggeredReason: evaluation.triggeredReason!,
    };

    const emailResult = await sendRefinanceAlert({
      sessionId,
      to: user.email,
      data: alertData,
    });

    await recordEvaluationRun({
      sessionId,
      outcome: "triggered",
      computedMetrics: evaluation.metrics as unknown as Record<string, unknown>,
      triggeredReason: evaluation.triggeredReason ?? undefined,
      notifiedAt: emailResult.sent ? new Date() : undefined,
    });
  } else {
    await recordEvaluationRun({
      sessionId,
      outcome: "triggered",
      computedMetrics: evaluation.metrics as unknown as Record<string, unknown>,
      triggeredReason: evaluation.triggeredReason ?? undefined,
    });
  }

  // Mark session as completed
  await updateSessionStatus(sessionId, "completed", {
    completedAt: new Date(),
    triggerMetadata: {
      benchmarkRate: rateData.value,
      metrics: evaluation.metrics,
      triggeredReason: evaluation.triggeredReason,
    },
  });

  return { triggered: true, metrics: evaluation.metrics as unknown as Record<string, unknown> };
}
