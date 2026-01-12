"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings, type SettingsFormData } from "@/lib/actions/settings";
import type { OnboardingProfile } from "@/lib/db/schema";

interface SettingsFormProps {
  profile: OnboardingProfile;
}

export function SettingsForm({ profile }: SettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<SettingsFormData>({
    currentRate: parseFloat(profile.currentRate),
    benchmarkRateThreshold: profile.benchmarkRateThreshold
      ? parseFloat(profile.benchmarkRateThreshold)
      : 5.5,
    emailAlertsEnabled: profile.emailAlertsEnabled,
  });

  const updateField = <K extends keyof SettingsFormData>(
    field: K,
    value: SettingsFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateSettings(formData);

      if (!result.success) {
        setError(result.error || "Failed to update settings");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {/* Alert Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Alert Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                Settings updated successfully!
              </div>
            )}

            <Input
              label="Your Current Interest Rate (%)"
              type="number"
              name="currentRate"
              step="0.001"
              placeholder="e.g., 6.5"
              value={formData.currentRate || ""}
              onChange={(e) =>
                updateField("currentRate", parseFloat(e.target.value) || 0)
              }
              hint="The annual interest rate on your current mortgage"
            />

            <Input
              label="Alert Threshold (%)"
              type="number"
              name="benchmarkRateThreshold"
              step="0.001"
              placeholder="e.g., 5.5"
              value={formData.benchmarkRateThreshold || ""}
              onChange={(e) =>
                updateField(
                  "benchmarkRateThreshold",
                  parseFloat(e.target.value) || 0
                )
              }
              hint="Alert me when the 30-year benchmark rate falls to or below this level"
            />
          </CardContent>
        </Card>

        {/* Email Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Email Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.emailAlertsEnabled}
                onChange={(e) =>
                  updateField("emailAlertsEnabled", e.target.checked)
                }
                className="mr-3 h-4 w-4 rounded border-gray-300 text-black focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">
                Send me an email when my threshold is met
              </span>
            </label>
          </CardContent>
          <CardFooter>
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </form>
  );
}
