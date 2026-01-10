"use server";

import { z } from "zod";
import { db, onboardingProfiles, monitorSessions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCurrentSession } from "@/lib/services/monitor";
import { revalidatePath } from "next/cache";

const settingsSchema = z.object({
  closingCostType: z.enum(["dollars", "percent"]),
  closingCostValue: z.coerce.number().min(0),
  benchmarkRateThreshold: z.coerce.number().min(0.1).max(20).optional().nullable(),
  breakEvenMonthsThreshold: z.coerce.number().int().min(1).max(360).optional().nullable(),
  emailAlertsEnabled: z.boolean(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateSettings(formData: SettingsFormData): Promise<ActionResult> {
  try {
    const user = await getAuthenticatedUser();

    // Validate input
    const validated = settingsSchema.parse(formData);

    // Ensure at least one threshold is set
    if (!validated.benchmarkRateThreshold && !validated.breakEvenMonthsThreshold) {
      return {
        success: false,
        error: "At least one alert threshold must be set",
      };
    }

    // Update profile
    await db
      .update(onboardingProfiles)
      .set({
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
      })
      .where(eq(onboardingProfiles.userId, user.id));

    // Increment threshold version on active session
    const session = await getCurrentSession(user.id);
    if (session && session.status === "active") {
      await db
        .update(monitorSessions)
        .set({
          thresholdVersion: session.thresholdVersion + 1,
        })
        .where(eq(monitorSessions.id, session.id));
    }

    revalidatePath("/status");
    revalidatePath("/settings");

    return { success: true };

  } catch (error) {
    console.error("Settings update error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(", "),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

export async function getSettings() {
  const user = await getAuthenticatedUser();

  const profile = await db
    .select()
    .from(onboardingProfiles)
    .where(eq(onboardingProfiles.userId, user.id))
    .limit(1);

  return profile[0] ?? null;
}
