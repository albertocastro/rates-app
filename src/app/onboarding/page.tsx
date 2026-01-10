import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/actions/onboarding";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const onboarded = await hasCompletedOnboarding();
  if (onboarded) {
    redirect("/status");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Set Up Your Refinance Monitor
          </h1>
          <p className="text-gray-600">
            Tell us about your mortgage and when you want to be notified.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  );
}
