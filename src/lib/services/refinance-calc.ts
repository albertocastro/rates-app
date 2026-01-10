import type { OnboardingProfile } from "@/lib/db/schema";

export interface RefinanceMetrics {
  currentRate: number;
  estimatedNewRate: number;
  currentMonthlyPayment: number;
  estimatedNewMonthlyPayment: number;
  monthlySavings: number;
  closingCosts: number;
  breakEvenMonths: number | null; // null if no savings or infinite
  totalSavingsOverTerm: number;
}

export interface EvaluationResult {
  triggered: boolean;
  metrics: RefinanceMetrics;
  triggeredReason: string | null;
  benchmarkRateTriggered: boolean;
  breakEvenTriggered: boolean;
}

/**
 * Calculate monthly mortgage payment using standard amortization formula
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Where:
 *   P = principal (loan balance)
 *   r = monthly interest rate (annual rate / 12)
 *   n = number of payments (term in months)
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  if (annualRate <= 0) return principal / termMonths;

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);

  return (principal * monthlyRate * factor) / (factor - 1);
}

/**
 * Calculate closing costs based on profile settings
 * Either uses fixed dollar amount or percentage of loan
 */
export function calculateClosingCosts(
  loanBalance: number,
  closingCostDollars: number | null,
  closingCostPercent: number | null
): number {
  if (closingCostDollars !== null && closingCostDollars > 0) {
    return closingCostDollars;
  }

  if (closingCostPercent !== null && closingCostPercent > 0) {
    return loanBalance * (closingCostPercent / 100);
  }

  // Default to 2% of loan balance if nothing specified
  return loanBalance * 0.02;
}

/**
 * Calculate break-even months
 * Returns null if monthly savings is zero or negative
 */
export function calculateBreakEvenMonths(
  closingCosts: number,
  monthlySavings: number
): number | null {
  if (monthlySavings <= 0) {
    return null; // Never breaks even
  }

  return Math.ceil(closingCosts / monthlySavings);
}

/**
 * Calculate all refinance metrics given a benchmark rate
 */
export function calculateRefinanceMetrics(
  profile: {
    loanBalance: number;
    currentRate: number;
    remainingTermMonths: number;
    closingCostDollars: number | null;
    closingCostPercent: number | null;
  },
  benchmarkRate: number
): RefinanceMetrics {
  const {
    loanBalance,
    currentRate,
    remainingTermMonths,
    closingCostDollars,
    closingCostPercent,
  } = profile;

  // Use benchmark rate as estimated new rate (proxy)
  const estimatedNewRate = benchmarkRate;

  // Calculate monthly payments
  const currentMonthlyPayment = calculateMonthlyPayment(
    loanBalance,
    currentRate,
    remainingTermMonths
  );

  const estimatedNewMonthlyPayment = calculateMonthlyPayment(
    loanBalance,
    estimatedNewRate,
    remainingTermMonths
  );

  // Calculate savings
  const monthlySavings = currentMonthlyPayment - estimatedNewMonthlyPayment;

  // Calculate closing costs
  const closingCosts = calculateClosingCosts(
    loanBalance,
    closingCostDollars,
    closingCostPercent
  );

  // Calculate break-even
  const breakEvenMonths = calculateBreakEvenMonths(closingCosts, monthlySavings);

  // Calculate total savings over remaining term
  const totalSavingsOverTerm =
    monthlySavings > 0
      ? monthlySavings * remainingTermMonths - closingCosts
      : 0;

  return {
    currentRate,
    estimatedNewRate,
    currentMonthlyPayment,
    estimatedNewMonthlyPayment,
    monthlySavings,
    closingCosts,
    breakEvenMonths,
    totalSavingsOverTerm,
  };
}

/**
 * Evaluate whether alert thresholds are met
 * This is the core deterministic trigger logic
 */
export function evaluateRefinanceTriggers(
  profile: {
    loanBalance: number;
    currentRate: number;
    remainingTermMonths: number;
    closingCostDollars: number | null;
    closingCostPercent: number | null;
    benchmarkRateThreshold: number | null;
    breakEvenMonthsThreshold: number | null;
    expectedTimeInHomeYears: number;
  },
  benchmarkRate: number
): EvaluationResult {
  const metrics = calculateRefinanceMetrics(
    {
      loanBalance: profile.loanBalance,
      currentRate: profile.currentRate,
      remainingTermMonths: profile.remainingTermMonths,
      closingCostDollars: profile.closingCostDollars,
      closingCostPercent: profile.closingCostPercent,
    },
    benchmarkRate
  );

  const { benchmarkRateThreshold, breakEvenMonthsThreshold } = profile;

  // Check benchmark rate threshold
  const benchmarkRateTriggered =
    benchmarkRateThreshold !== null && benchmarkRate <= benchmarkRateThreshold;

  // Check break-even threshold (only if there are savings)
  const breakEvenTriggered =
    breakEvenMonthsThreshold !== null &&
    metrics.breakEvenMonths !== null &&
    metrics.breakEvenMonths <= breakEvenMonthsThreshold;

  // Build trigger reason
  const reasons: string[] = [];

  if (benchmarkRateTriggered) {
    reasons.push(
      `The 30-year benchmark rate (${benchmarkRate.toFixed(3)}%) dropped to or below your threshold of ${benchmarkRateThreshold!.toFixed(3)}%`
    );
  }

  if (breakEvenTriggered) {
    reasons.push(
      `Your estimated break-even period (${metrics.breakEvenMonths} months) is at or below your threshold of ${breakEvenMonthsThreshold} months`
    );
  }

  const triggered = benchmarkRateTriggered || breakEvenTriggered;
  const triggeredReason =
    reasons.length > 0 ? reasons.join(". Additionally, ") + "." : null;

  return {
    triggered,
    metrics,
    triggeredReason,
    benchmarkRateTriggered,
    breakEvenTriggered,
  };
}

/**
 * Convert profile from database format to calculation format
 */
export function profileToCalcInput(profile: OnboardingProfile) {
  return {
    loanBalance: parseFloat(profile.loanBalance),
    currentRate: parseFloat(profile.currentRate),
    remainingTermMonths: profile.remainingTermMonths,
    closingCostDollars: profile.closingCostDollars
      ? parseFloat(profile.closingCostDollars)
      : null,
    closingCostPercent: profile.closingCostPercent
      ? parseFloat(profile.closingCostPercent)
      : null,
    benchmarkRateThreshold: profile.benchmarkRateThreshold
      ? parseFloat(profile.benchmarkRateThreshold)
      : null,
    breakEvenMonthsThreshold: profile.breakEvenMonthsThreshold,
    expectedTimeInHomeYears: profile.expectedTimeInHomeYears,
  };
}
