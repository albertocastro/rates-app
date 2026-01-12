import type { OnboardingProfile } from "@/lib/db/schema";

export interface EvaluationResult {
  triggered: boolean;
  currentRate: number;
  benchmarkRate: number;
  benchmarkRateThreshold: number | null;
  triggeredReason: string | null;
}

/**
 * Evaluate whether the benchmark rate threshold is met
 * Simplified to just check if benchmark rate <= threshold
 */
export function evaluateRefinanceTriggers(
  profile: {
    currentRate: number;
    benchmarkRateThreshold: number | null;
  },
  benchmarkRate: number
): EvaluationResult {
  const { currentRate, benchmarkRateThreshold } = profile;

  // Check benchmark rate threshold
  const triggered =
    benchmarkRateThreshold !== null && benchmarkRate <= benchmarkRateThreshold;

  // Build trigger reason
  let triggeredReason: string | null = null;

  if (triggered) {
    triggeredReason = `The 30-year benchmark rate (${benchmarkRate.toFixed(3)}%) dropped to or below your threshold of ${benchmarkRateThreshold!.toFixed(3)}%.`;
  }

  return {
    triggered,
    currentRate,
    benchmarkRate,
    benchmarkRateThreshold,
    triggeredReason,
  };
}

/**
 * Convert profile from database format to calculation format
 */
export function profileToCalcInput(profile: OnboardingProfile) {
  return {
    currentRate: parseFloat(profile.currentRate),
    benchmarkRateThreshold: profile.benchmarkRateThreshold
      ? parseFloat(profile.benchmarkRateThreshold)
      : null,
  };
}
