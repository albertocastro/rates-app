import { db, rateSnapshots } from "@/lib/db";
import { eq, desc, and, gte } from "drizzle-orm";

// Optimal Blue 30-Year Fixed Rate Conforming Mortgage Index (via FRED)
// Updates daily (weekdays)
export const RATE_SERIES = "OBMMIC30YF";
export const RATE_SERIES_NAME = "Optimal Blue 30-Year Fixed Rate Conforming Mortgage Index";
export const DATA_SOURCE = "Federal Reserve Economic Data (FRED)";
export const UPDATE_CADENCE = "Daily (weekdays)";

interface FREDObservation {
  date: string;
  value: string;
}

interface FREDResponse {
  observations: FREDObservation[];
}

/**
 * Fetches the latest mortgage rate from FRED API
 * Optimal Blue series updates daily on weekdays
 */
export async function fetchLatestRate(): Promise<{
  date: Date;
  value: number;
} | null> {
  const apiKey = process.env.FRED_API_KEY;

  // FRED API allows limited access without API key, but key is recommended
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", RATE_SERIES);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");

  if (apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`FRED API error: ${response.status}`);
      return null;
    }

    const data: FREDResponse = await response.json();

    if (!data.observations || data.observations.length === 0) {
      console.error("No observations returned from FRED");
      return null;
    }

    const latest = data.observations[0];

    // FRED returns "." for missing values
    if (latest.value === ".") {
      console.error("Latest FRED observation has no value");
      return null;
    }

    return {
      date: new Date(latest.date),
      value: parseFloat(latest.value),
    };
  } catch (error) {
    console.error("Failed to fetch rate from FRED:", error);
    return null;
  }
}

/**
 * Stores a rate snapshot idempotently
 * Returns true if new snapshot was created, false if it already existed
 */
export async function storeRateSnapshot(
  series: string,
  snapshotDate: Date,
  value: number
): Promise<boolean> {
  try {
    await db
      .insert(rateSnapshots)
      .values({
        series,
        snapshotDate,
        value: value.toString(),
      })
      .onConflictDoNothing();

    return true;
  } catch (error) {
    console.error("Failed to store rate snapshot:", error);
    return false;
  }
}

/**
 * Gets the latest stored rate for a series
 */
export async function getLatestStoredRate(series: string = RATE_SERIES) {
  const result = await db
    .select()
    .from(rateSnapshots)
    .where(eq(rateSnapshots.series, series))
    .orderBy(desc(rateSnapshots.snapshotDate))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Gets rate history for a series since a given date
 * Filters by fetchedAt (when we stored it) not snapshotDate (FRED observation date)
 */
export async function getRateHistory(
  series: string = RATE_SERIES,
  since?: Date
) {
  const conditions = [eq(rateSnapshots.series, series)];

  if (since) {
    // Use fetchedAt to show rates collected during monitoring, not by FRED publication date
    conditions.push(gte(rateSnapshots.fetchedAt, since));
  }

  return db
    .select()
    .from(rateSnapshots)
    .where(and(...conditions))
    .orderBy(desc(rateSnapshots.snapshotDate));
}

/**
 * Fetches and stores the latest rate
 * Returns the rate if successful, null otherwise
 */
export async function fetchAndStoreLatestRate(): Promise<{
  date: Date;
  value: number;
  isNew: boolean;
} | null> {
  const latest = await fetchLatestRate();

  if (!latest) {
    return null;
  }

  const isNew = await storeRateSnapshot(RATE_SERIES, latest.date, latest.value);

  return {
    ...latest,
    isNew,
  };
}
