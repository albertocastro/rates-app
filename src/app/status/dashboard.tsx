"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  pauseMonitor,
  resumeMonitor,
  stopMonitor,
  startOverMonitor,
  runNowAction,
  tryEmailAction,
} from "@/lib/actions/monitor";
import type { MonitorSession, EvaluationRun, OnboardingProfile, RateSnapshot } from "@/lib/db/schema";
import { RateChart } from "./rate-chart";

interface StatusDashboardProps {
  session: MonitorSession | null;
  evaluations: EvaluationRun[];
  profile: OnboardingProfile | null;
  rateSnapshots: RateSnapshot[];
  dataSourceInfo: {
    name: string;
    source: string;
    updateCadence: string;
  };
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  paused: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  completed: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  stopped: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
  error: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

export function StatusDashboard({
  session,
  evaluations,
  profile,
  rateSnapshots,
  dataSourceInfo,
}: StatusDashboardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [emailSuccess, setEmailSuccess] = useState(false);

  const handleAction = async (
    action: "pause" | "resume" | "stop" | "startOver" | "runNow" | "tryEmail"
  ) => {
    setLoading(action);
    setError(null);
    setEmailSuccess(false);

    try {
      let result;
      switch (action) {
        case "pause":
          result = await pauseMonitor();
          break;
        case "resume":
          result = await resumeMonitor();
          break;
        case "stop":
          result = await stopMonitor();
          break;
        case "startOver":
          result = await startOverMonitor();
          break;
        case "runNow":
          result = await runNowAction();
          break;
        case "tryEmail":
          result = await tryEmailAction();
          if (result.success) {
            setEmailSuccess(true);
          }
          break;
      }

      if (!result.success) {
        setError(result.error || "Action failed");
      } else if (action !== "tryEmail") {
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(null);
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-600">No active monitoring session found.</p>
          <Button className="mt-4" onClick={() => handleAction("startOver")}>
            Start Monitoring
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusColor = STATUS_COLORS[session.status] || STATUS_COLORS.error;
  const triggerMeta = session.triggerMetadata as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {emailSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          Test email sent! Check your inbox.
        </div>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Monitor Status</CardTitle>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColor.bg} ${statusColor.text}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusColor.dot} mr-2`} />
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Started</p>
              <p className="font-medium">
                {format(new Date(session.createdAt), "MMM d, yyyy h:mm a")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Check</p>
              <p className="font-medium">
                {session.lastCheckAt
                  ? formatDistanceToNow(new Date(session.lastCheckAt), {
                      addSuffix: true,
                    })
                  : "Not yet checked"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Check</p>
              <p className="font-medium">
                {session.status === "active"
                  ? session.lastCheckAt
                    ? "In ~24 hours"
                    : "Soon"
                  : "—"}
              </p>
            </div>
          </div>

          {/* Trigger reason for completed sessions */}
          {session.status === "completed" && triggerMeta && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">
                Alert Triggered
              </h4>
              <p className="text-blue-800 text-sm">
                {(triggerMeta.triggeredReason as string) ||
                  "Your refinance criteria were met."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Benchmark Rate:</span>{" "}
                  <span className="font-medium">
                    {typeof triggerMeta.benchmarkRate === "number"
                      ? `${triggerMeta.benchmarkRate.toFixed(3)}%`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600">Triggered:</span>{" "}
                  <span className="font-medium">
                    {session.completedAt
                      ? format(new Date(session.completedAt), "MMM d, yyyy")
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {session.status === "error" && session.lastError && (
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-red-800 text-sm">{session.lastError}</p>
            </div>
          )}

          {/* Controls */}
          <div className="mt-6 flex flex-wrap gap-3">
            {session.status === "active" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => handleAction("pause")}
                  loading={loading === "pause"}
                  disabled={loading !== null}
                >
                  Pause
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAction("runNow")}
                  loading={loading === "runNow"}
                  disabled={loading !== null}
                >
                  Run Now
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAction("tryEmail")}
                  loading={loading === "tryEmail"}
                  disabled={loading !== null}
                >
                  Try Email
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleAction("stop")}
                  loading={loading === "stop"}
                  disabled={loading !== null}
                >
                  Stop
                </Button>
              </>
            )}

            {session.status === "paused" && (
              <>
                <Button
                  onClick={() => handleAction("resume")}
                  loading={loading === "resume"}
                  disabled={loading !== null}
                >
                  Resume
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleAction("stop")}
                  loading={loading === "stop"}
                  disabled={loading !== null}
                >
                  Stop
                </Button>
              </>
            )}

            {(session.status === "completed" ||
              session.status === "stopped" ||
              session.status === "error") && (
              <Button
                onClick={() => handleAction("startOver")}
                loading={loading === "startOver"}
                disabled={loading !== null}
              >
                Start Over
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thresholds Card */}
      {profile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Thresholds</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push("/settings")}>
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Benchmark Rate Threshold</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.benchmarkRateThreshold
                    ? `${parseFloat(profile.benchmarkRateThreshold).toFixed(3)}%`
                    : "Not set"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Alert when rate falls to or below this
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Break-Even Threshold</p>
                <p className="text-2xl font-bold text-gray-900">
                  {profile.breakEvenMonthsThreshold
                    ? `${profile.breakEvenMonthsThreshold} months`
                    : "Not set"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Alert when break-even period is this or shorter
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Rate History</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            {dataSourceInfo.name} • {dataSourceInfo.updateCadence}
          </p>
        </CardHeader>
        <CardContent>
          {rateSnapshots.length > 0 ? (
            <RateChart
              data={rateSnapshots}
              threshold={
                profile?.benchmarkRateThreshold
                  ? parseFloat(profile.benchmarkRateThreshold)
                  : undefined
              }
            />
          ) : (
            <div className="py-12 text-center text-gray-500">
              No rate data yet. Data will appear after the first check.
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4 text-center">
            Source: {dataSourceInfo.source}
          </p>
        </CardContent>
      </Card>

      {/* Evaluation History */}
      {evaluations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">
                      Date
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">
                      Outcome
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">
                      Benchmark Rate
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.slice(0, 10).map((evaluation) => {
                    const metrics = evaluation.computedMetrics as Record<
                      string,
                      unknown
                    > | null;
                    return (
                      <tr key={evaluation.id} className="border-b last:border-0">
                        <td className="py-2 px-3">
                          {format(
                            new Date(evaluation.ranAt),
                            "MMM d, yyyy h:mm a"
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              evaluation.outcome === "triggered"
                                ? "bg-blue-100 text-blue-800"
                                : evaluation.outcome === "error"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {evaluation.outcome}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {metrics?.estimatedNewRate
                            ? `${(metrics.estimatedNewRate as number).toFixed(3)}%`
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-gray-600 max-w-xs truncate">
                          {evaluation.triggeredReason || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
