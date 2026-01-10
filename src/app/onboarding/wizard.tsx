"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { submitOnboarding, type OnboardingFormData } from "@/lib/actions/onboarding";

type Step = 1 | 2 | 3 | 4;

const STEPS: { title: string; description: string }[] = [
  { title: "Loan Details", description: "Your current mortgage information" },
  { title: "Time Horizon", description: "How long you plan to stay" },
  { title: "Closing Costs", description: "Estimated refinance costs" },
  { title: "Alert Thresholds", description: "When to notify you" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OnboardingFormData>({
    loanBalance: 0,
    currentRate: 0,
    remainingTermMonths: 360,
    expectedTimeInHomeYears: 7,
    closingCostType: "percent",
    closingCostValue: 2,
    benchmarkRateThreshold: undefined,
    breakEvenMonthsThreshold: undefined,
    emailAlertsEnabled: true,
  });

  const updateField = <K extends keyof OnboardingFormData>(
    field: K,
    value: OnboardingFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateStep = (): boolean => {
    setError(null);

    switch (step) {
      case 1:
        if (!formData.loanBalance || formData.loanBalance < 1000) {
          setError("Please enter a valid loan balance (minimum $1,000)");
          return false;
        }
        if (!formData.currentRate || formData.currentRate < 0.1 || formData.currentRate > 20) {
          setError("Please enter a valid interest rate (0.1% - 20%)");
          return false;
        }
        if (!formData.remainingTermMonths || formData.remainingTermMonths < 1) {
          setError("Please enter a valid remaining term");
          return false;
        }
        return true;

      case 2:
        if (!formData.expectedTimeInHomeYears || formData.expectedTimeInHomeYears < 1) {
          setError("Please enter how long you plan to stay");
          return false;
        }
        return true;

      case 3:
        if (formData.closingCostValue < 0) {
          setError("Closing cost cannot be negative");
          return false;
        }
        return true;

      case 4:
        if (!formData.benchmarkRateThreshold && !formData.breakEvenMonthsThreshold) {
          setError("Please set at least one alert threshold");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    if (step < 4) {
      setStep((s) => (s + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as Step);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

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
    <div>
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i + 1 <= step
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    i + 1 < step ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <span
                className={`text-xs ${
                  i + 1 === step ? "text-indigo-600 font-medium" : "text-gray-500"
                }`}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step - 1].title}</CardTitle>
          <p className="text-gray-600">{STEPS[step - 1].description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <Input
                label="Current Loan Balance"
                type="number"
                name="loanBalance"
                placeholder="e.g., 350000"
                value={formData.loanBalance || ""}
                onChange={(e) => updateField("loanBalance", parseFloat(e.target.value) || 0)}
                hint="The remaining principal on your mortgage"
              />
              <Input
                label="Current Interest Rate (%)"
                type="number"
                name="currentRate"
                step="0.001"
                placeholder="e.g., 6.5"
                value={formData.currentRate || ""}
                onChange={(e) => updateField("currentRate", parseFloat(e.target.value) || 0)}
                hint="Your current annual interest rate"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remaining Term
                </label>
                <div className="flex gap-4">
                  <Input
                    type="number"
                    name="remainingYears"
                    placeholder="Years"
                    value={Math.floor(formData.remainingTermMonths / 12) || ""}
                    onChange={(e) => {
                      const years = parseInt(e.target.value) || 0;
                      const months = formData.remainingTermMonths % 12;
                      updateField("remainingTermMonths", years * 12 + months);
                    }}
                  />
                  <Input
                    type="number"
                    name="remainingMonths"
                    placeholder="Months"
                    value={formData.remainingTermMonths % 12 || ""}
                    onChange={(e) => {
                      const months = parseInt(e.target.value) || 0;
                      const years = Math.floor(formData.remainingTermMonths / 12);
                      updateField("remainingTermMonths", years * 12 + months);
                    }}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  How much time is left on your current loan
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <Input
              label="Expected Time in Home (years)"
              type="number"
              name="expectedTimeInHomeYears"
              placeholder="e.g., 7"
              value={formData.expectedTimeInHomeYears || ""}
              onChange={(e) => updateField("expectedTimeInHomeYears", parseInt(e.target.value) || 0)}
              hint="How many more years you plan to live in this home"
            />
          )}

          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Closing Cost Estimate
                </label>
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
                  placeholder={formData.closingCostType === "percent" ? "e.g., 2" : "e.g., 7000"}
                  value={formData.closingCostValue || ""}
                  onChange={(e) => updateField("closingCostValue", parseFloat(e.target.value) || 0)}
                  hint={
                    formData.closingCostType === "percent"
                      ? "Typical range: 2-5% of loan amount"
                      : "Estimated total closing costs in dollars"
                  }
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Set at least one threshold. You'll be notified when either condition is met.
              </p>
              <Input
                label="Benchmark Rate Threshold (%)"
                type="number"
                name="benchmarkRateThreshold"
                step="0.001"
                placeholder="e.g., 5.5"
                value={formData.benchmarkRateThreshold || ""}
                onChange={(e) =>
                  updateField(
                    "benchmarkRateThreshold",
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
                hint="Alert me when the 30-year benchmark rate falls to or below this level"
              />
              <Input
                label="Break-Even Months Threshold"
                type="number"
                name="breakEvenMonthsThreshold"
                placeholder="e.g., 24"
                value={formData.breakEvenMonthsThreshold || ""}
                onChange={(e) =>
                  updateField(
                    "breakEvenMonthsThreshold",
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
                hint="Alert me when I can recoup closing costs within this many months"
              />
              <div className="pt-4 border-t">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.emailAlertsEnabled}
                    onChange={(e) => updateField("emailAlertsEnabled", e.target.checked)}
                    className="mr-3 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">
                    Send me an email when my thresholds are met
                  </span>
                </label>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || loading}
          >
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              Start Monitoring
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
