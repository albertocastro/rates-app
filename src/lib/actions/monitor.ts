"use server";

import { getAuthenticatedUser } from "@/lib/auth";
import {
  getCurrentSession,
  pauseSession,
  resumeSession,
  stopSession,
  startOver,
  runNow,
  getEvaluationHistory,
} from "@/lib/services/monitor";
import { getRateHistory, RATE_SERIES } from "@/lib/services/rates";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function getMonitorStatus() {
  const user = await getAuthenticatedUser();
  const session = await getCurrentSession(user.id);

  if (!session) {
    return null;
  }

  const evaluations = await getEvaluationHistory(session.id);

  return {
    session,
    evaluations,
    lastTriggeredRun: evaluations.find((e) => e.outcome === "triggered"),
  };
}

export async function getRateSnapshots(since?: Date) {
  const user = await getAuthenticatedUser();
  const session = await getCurrentSession(user.id);

  // If user has a session, get rates since session creation
  // Otherwise, get last 30 days
  const sinceDate = since ?? session?.createdAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return getRateHistory(RATE_SERIES, sinceDate);
}

export async function pauseMonitor(): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const session = await getCurrentSession(user.id);

    if (!session) {
      return { success: false, error: "No active session found" };
    }

    if (session.status !== "active") {
      return { success: false, error: "Session is not active" };
    }

    await pauseSession(session.id);
    revalidatePath("/status");

    return { success: true };
  } catch (error) {
    console.error("Pause error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to pause",
    };
  }
}

export async function resumeMonitor(): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const session = await getCurrentSession(user.id);

    if (!session) {
      return { success: false, error: "No session found" };
    }

    if (session.status !== "paused") {
      return { success: false, error: "Session is not paused" };
    }

    await resumeSession(session.id);
    revalidatePath("/status");

    return { success: true };
  } catch (error) {
    console.error("Resume error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resume",
    };
  }
}

export async function stopMonitor(): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();
    const session = await getCurrentSession(user.id);

    if (!session) {
      return { success: false, error: "No session found" };
    }

    if (!["active", "paused", "error"].includes(session.status)) {
      return { success: false, error: "Session cannot be stopped" };
    }

    await stopSession(session.id);
    revalidatePath("/status");

    return { success: true };
  } catch (error) {
    console.error("Stop error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to stop",
    };
  }
}

export async function startOverMonitor(): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();

    await startOver(user.id);
    revalidatePath("/status");

    return { success: true };
  } catch (error) {
    console.error("Start over error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start over",
    };
  }
}

export async function runNowAction(): Promise<ActionResult & { triggered?: boolean }> {
  try {
    const user = await getAuthenticatedUser();
    const session = await getCurrentSession(user.id);

    if (!session) {
      return { success: false, error: "No session found" };
    }

    if (session.status !== "active") {
      return { success: false, error: "Session is not active" };
    }

    const result = await runNow(session.id);
    revalidatePath("/status");

    return { success: true, triggered: result.triggered };
  } catch (error) {
    console.error("Run now error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run",
    };
  }
}
