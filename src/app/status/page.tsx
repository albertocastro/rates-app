import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCompletedOnboarding, getOnboardingProfile } from "@/lib/actions/onboarding";
import { getMonitorStatus, getRateSnapshots } from "@/lib/actions/monitor";
import { StatusDashboard } from "./dashboard";
import { RATE_SERIES_NAME, DATA_SOURCE, UPDATE_CADENCE } from "@/lib/services/rates";

export default async function StatusPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const onboarded = await hasCompletedOnboarding();
  if (!onboarded) {
    redirect("/onboarding");
  }

  const [monitorStatus, profile, rateSnapshots] = await Promise.all([
    getMonitorStatus(),
    getOnboardingProfile(),
    getRateSnapshots(),
  ]);

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Track your refinance monitoring status and rate history
          </p>
        </div>

        <StatusDashboard
          session={monitorStatus?.session ?? null}
          evaluations={monitorStatus?.evaluations ?? []}
          profile={profile}
          rateSnapshots={rateSnapshots}
          dataSourceInfo={{
            name: RATE_SERIES_NAME,
            source: DATA_SOURCE,
            updateCadence: UPDATE_CADENCE,
          }}
        />
      </div>
    </div>
  );
}
