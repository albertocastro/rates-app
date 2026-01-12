import { NextRequest, NextResponse } from "next/server";
import { getSessionById, runEvaluation } from "@/lib/services/monitor";

/**
 * POST: Trigger evaluation for a specific session
 * Called when user clicks "Start Over" or "Run Now"
 *
 * Note: Vercel Workflow DevKit (workflow npm package) is currently incompatible
 * with Next.js 16's Turbopack due to WASI module resolution issues.
 * Using cron job approach instead (/api/cron/check-rates).
 * Revisit when workflow package adds Turbopack support.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Run evaluation
    const result = await runEvaluation(sessionId);

    return NextResponse.json({
      status: "completed",
      triggered: result.triggered,
      evaluation: result.evaluation
    });

  } catch (error) {
    console.error("Workflow API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET: Manual trigger for a specific session (dev/testing)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const result = await runEvaluation(sessionId);

  return NextResponse.json({ result });
}
