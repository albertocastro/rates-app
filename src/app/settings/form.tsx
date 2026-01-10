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
    closingCostType: profile.closingCostDollars ? "dollars" : "percent",
    closingCostValue: profile.closingCostDollars
      ? parseFloat(profile.closingCostDollars)
      : profile.closingCostPercent
      ? parseFloat(profile.closingCostPercent)
      : 2,
    benchmarkRateThreshold: profile.benchmarkRateThreshold
      ? parseFloat(profile.benchmarkRateThreshold)
      : null,
    breakEvenMonthsThreshold: profile.breakEvenMonthsThreshold ?? null,
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
        {/* Loan Summary (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Loan Balance</p>
                <p className="font-medium">
                  ${parseFloat(profile.loanBalance).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Current Rate</p>
                <p className="font-medium">
                  {parseFloat(profile.currentRate).toFixed(3)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Remaining Term</p>
                <p className="font-medium">
                  {Math.floor(profile.remainingTermMonths / 12)} years{" "}
                  {profile.remainingTermMonths % 12} months
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              To update loan details, please start over from the dashboard.
            </p>
          </CardContent>
        </Card>

        {/* Closing Costs */}
        <Card>
          <CardHeader>
            <CardTitle>Closing Cost Estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="closingCostType"
                  value="percent"
                  checked={formData.closingCostType === "percent"}
                  onChange={() => updateField("closingCostType", "percent")}
                  className="mr-2"
                />
                Percentage of loan
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="closingCostType"
                  value="dollars"
                  checked={formData.closingCostType === "dollars"}
                  onChange={() => updateField("closingCostType", "dollars")}
                  className="mr-2"
                />
                Fixed dollar amount
              </label>
            </div>
            <Input
              type="number"
              name="closingCostValue"
              step={formData.closingCostType === "percent" ? "0.1" : "100"}
              placeholder={
                formData.closingCostType === "percent" ? "e.g., 2" : "e.g., 7000"
              }
              value={formData.closingCostValue || ""}
              onChange={(e) =>
                updateField("closingCostValue", parseFloat(e.target.value) || 0)
              }
              hint={
                formData.closingCostType === "percent"
                  ? "Typical range: 2-5% of loan amount"
                  : "Estimated total closing costs in dollars"
              }
            />
          </CardContent>
        </Card>

        {/* Alert Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
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

            <p className="text-sm text-gray-600">
              Set at least one threshold. You'll be notified when either condition
              is met.
            </p>

            <Input
              label="Benchmark Rate Threshold (%)"
              type="number"
              name="benchmarkRateThreshold"
              step="0.001"
              placeholder="e.g., 5.5"
              value={formData.benchmarkRateThreshold ?? ""}
              onChange={(e) =>
                updateField(
                  "benchmarkRateThreshold",
                  e.target.value ? parseFloat(e.target.value) : null
                )
              }
              hint="Alert me when the 30-year benchmark rate falls to or below this level"
            />

            <Input
              label="Break-Even Months Threshold"
              type="number"
              name="breakEvenMonthsThreshold"
              placeholder="e.g., 24"
              value={formData.breakEvenMonthsThreshold ?? ""}
              onChange={(e) =>
                updateField(
                  "breakEvenMonthsThreshold",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              hint="Alert me when I can recoup closing costs within this many months"
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
                className="mr-3 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                Send me an email when my thresholds are met
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
