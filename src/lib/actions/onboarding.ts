"use server";

import { z } from "zod";
import { db, onboardingProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { createMonitorSession, triggerWorkflowRun } from "@/lib/services/monitor";
import { revalidatePath } from "next/cache";

// Validation schema for onboarding
const onboardingSchema = z.object({
  loanBalance: z.coerce.number().min(1000).max(10000000),
  currentRate: z.coerce.number().min(0.1).max(20),
  remainingTermMonths: z.coerce.number().int().min(1).max(480),
  expectedTimeInHomeYears: z.coerce.number().int().min(1).max(40),
  closingCostType: z.enum(["dollars", "percent"]),
  closingCostValue: z.coerce.number().min(0),
  benchmarkRateThreshold: z.coerce.number().min(0.1).max(20).optional(),
  breakEvenMonthsThreshold: z.coerce.number().int().min(1).max(360).optional(),
  emailAlertsEnabled: z.boolean().default(true),
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;

export interface ActionResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

export async function submitOnboarding(formData: OnboardingFormData): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();

    // Validate input
    const validated = onboardingSchema.parse(formData);

    // Ensure at least one threshold is set
    if (!validated.benchmarkRateThreshold && !validated.breakEvenMonthsThreshold) {
      return {
        success: false,
        error: "At least one alert threshold must be set",
      };
    }

    // Check if user already has a profile
    const existingProfile = await db
      .select()
      .from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, user.id))
      .limit(1);

    const profileData = {
      userId: user.id,
      loanBalance: validated.loanBalance.toString(),
      currentRate: validated.currentRate.toString(),
      remainingTermMonths: validated.remainingTermMonths,
      expectedTimeInHomeYears: validated.expectedTimeInHomeYears,
      closingCostDollars:
        validated.closingCostType === "dollars"
          ? validated.closingCostValue.toString()
          : null,
      closingCostPercent:
        validated.closingCostType === "percent"
          ? validated.closingCostValue.toString()
          : null,
      benchmarkRateThreshold: validated.benchmarkRateThreshold?.toString() ?? null,
      breakEvenMonthsThreshold: validated.breakEvenMonthsThreshold ?? null,
      emailAlertsEnabled: validated.emailAlertsEnabled,
      updatedAt: new Date(),
    };

    if (existingProfile.length > 0) {
      // Update existing profile
      await db
        .update(onboardingProfiles)
        .set(profileData)
        .where(eq(onboardingProfiles.userId, user.id));
    } else {
      // Create new profile
      await db.insert(onboardingProfiles).values(profileData);
    }

    // Create a new monitor session
    const sessionId = await createMonitorSession(user.id);

    // Trigger the workflow
    await triggerWorkflowRun(sessionId);

    revalidatePath("/status");
    revalidatePath("/onboarding");

    return { success: true, sessionId };

  } catch (error) {
    console.error("Onboarding error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save profile",
    };
  }
}

export async function getOnboardingProfile() {
  const user = await getAuthenticatedUser();

  const profile = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .limit(1);

  return profile[0] ?? null;
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const user = await getAuthenticatedUser();

    const profile = await db
      .select()
      .from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, user.id))
      .limit(1);

    return profile.length > 0;
  } catch {
    return false;
  }
}
