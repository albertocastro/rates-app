"use server";

import { z } from "zod";
import { db, onboardingProfiles } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { createMonitorSession, triggerWorkflowRun } from "@/lib/services/monitor";
import { revalidatePath } from "next/cache";

// Simplified validation schema - just current rate and threshold
const onboardingSchema = z.object({
  currentRate: z.coerce.number().min(0.1).max(20),
  benchmarkRateThreshold: z.coerce.number().min(0.1).max(20),
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

    // Check if user already has a profile
    const existingProfile = await db
      .select()
      .from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, user.id))
      .limit(1);

    const profileData = {
      userId: user.id,
      currentRate: validated.currentRate.toString(),
      benchmarkRateThreshold: validated.benchmarkRateThreshold.toString(),
      emailAlertsEnabled: validated.emailAlertsEnabled,
      // Set defaults for unused fields (DB columns still exist)
      loanBalance: "0",
      remainingTermMonths: 360,
      expectedTimeInHomeYears: 7,
      closingCostDollars: null,
      closingCostPercent: null,
      breakEvenMonthsThreshold: null,
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
