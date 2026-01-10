import { NextRequest, NextResponse } from "next/server";
import { db, monitorSessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { runEvaluation } from "@/lib/services/monitor";

/**
 * Cron job endpoint - checks all active sessions
 * Configured in vercel.json to run daily
 *
 * Vercel Cron Jobs automatically add CRON_SECRET header for verification
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel adds this automatically)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Starting daily rate check cron job");

  try {
    // Get all active sessions
    const activeSessions = await db
      .select()
      .from(monitorSessions)
      .where(eq(monitorSessions.status, "active"));

    console.log(`Found ${activeSessions.length} active sessions`);

    const results = [];

    // Process each session
    for (const session of activeSessions) {
      try {
        console.log(`Evaluating session ${session.id} for user ${session.userId}`);
        const result = await runEvaluation(session.id);
        results.push({
          sessionId: session.id,
          triggered: result.triggered,
          success: true,
        });
      } catch (error) {
        console.error(`Error evaluating session ${session.id}:`, error);
        results.push({
          sessionId: session.id,
          success: false,
          error: String(error),
        });
      }
    }

    const triggered = results.filter((r) => r.triggered).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `Cron job complete: ${activeSessions.length} sessions checked, ${triggered} triggered, ${failed} failed`
    );

    return NextResponse.json({
      status: "completed",
      sessionsChecked: activeSessions.length,
      triggered,
      failed,
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
