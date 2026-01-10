import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCompletedOnboarding, getOnboardingProfile } from "@/lib/actions/onboarding";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const onboarded = await hasCompletedOnboarding();
  if (!onboarded) {
    redirect("/onboarding");
  }

  const profile = await getOnboardingProfile();

  if (!profile) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">
            Update your monitoring thresholds and preferences
          </p>
        </div>

        <SettingsForm profile={profile} />
      </div>
    </div>
  );
}
