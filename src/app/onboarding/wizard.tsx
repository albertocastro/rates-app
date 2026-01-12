"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { submitOnboarding, type OnboardingFormData } from "@/lib/actions/onboarding";

export function OnboardingWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingFormData>({
    currentRate: 0,
    benchmarkRateThreshold: 0,
    emailAlertsEnabled: true,
  });

  const updateField = <K extends keyof OnboardingFormData>(
    field: K,
    value: OnboardingFormData[K]
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-fill threshold when user enters their rate
      if (field === "currentRate" && typeof value === "number" && value > 1) {
        updated.benchmarkRateThreshold = Math.max(0.1, value - 1);
      }

      return updated;
    });
    setError(null);
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.currentRate || formData.currentRate < 0.1 || formData.currentRate > 20) {
      setError("Please enter a valid interest rate (0.1% - 20%)");
      return;
    }
    if (!formData.benchmarkRateThreshold || formData.benchmarkRateThreshold < 0.1) {
      setError("Please enter a valid rate threshold");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await submitOnboarding(formData);

      if (!result.success) {
        setError(result.error || "Failed to save your settings");
        return;
      }

      router.push("/status");
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Up Your Rate Alert</CardTitle>
        <p className="text-gray-600">
          Tell us your current rate and when you want to be notified.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <Input
          label="Your Current Interest Rate (%)"
          type="number"
          name="currentRate"
          step="0.001"
          placeholder="e.g., 6.5"
          value={formData.currentRate || ""}
          onChange={(e) => updateField("currentRate", parseFloat(e.target.value) || 0)}
          hint="The annual interest rate on your current mortgage"
        />

        <Input
          label="Alert Me When Benchmark Rate Falls Below (%)"
          type="number"
          name="benchmarkRateThreshold"
          step="0.001"
          placeholder="e.g., 5.5"
          value={formData.benchmarkRateThreshold || ""}
          onChange={(e) => updateField("benchmarkRateThreshold", parseFloat(e.target.value) || 0)}
          hint="We'll email you when the 30-year benchmark rate drops to this level"
        />

        <div className="pt-4 border-t">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.emailAlertsEnabled}
              onChange={(e) => updateField("emailAlertsEnabled", e.target.checked)}
              className="mr-3 h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-500"
            />
            <span className="text-sm text-gray-700">
              Send me an email when my threshold is met
            </span>
          </label>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} loading={loading} className="w-full">
          Start Monitoring
        </Button>
      </CardFooter>
    </Card>
  );
}
