import { Resend } from "resend";
import { db, alertEvents } from "@/lib/db";
import { eq } from "drizzle-orm";

// Email provider abstraction
interface EmailProvider {
  send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ id: string } | null>;
}

class ResendProvider implements EmailProvider {
  private client: Resend;
  private from: string;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.EMAIL_FROM || "Popis Interest Rates <alerts@popis.io>";
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ id: string } | null> {
    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (result.error) {
        console.error("Resend error:", result.error);
        return null;
      }

      return { id: result.data?.id ?? "unknown" };
    } catch (error) {
      console.error("Failed to send email:", error);
      return null;
    }
  }
}

// Singleton email provider instance
let emailProvider: EmailProvider | null = null;

function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    emailProvider = new ResendProvider();
  }
  return emailProvider;
}

export interface RefinanceAlertData {
  userName: string;
  currentRate: number;
  benchmarkRate: number;
  benchmarkRateThreshold: number;
  triggeredReason: string;
}

/**
 * Generates the alert email HTML - simplified version
 */
function generateAlertEmailHtml(data: RefinanceAlertData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rate Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #000000; padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🐄 Rate Alert!</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px; margin-top: 0;">Hi ${data.userName},</p>

    <p style="font-size: 16px;">Good news! The benchmark mortgage rate has dropped to a level you were watching.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #000000;">Rate Update</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Your Current Rate</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${data.currentRate.toFixed(3)}%</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Current Benchmark Rate</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #28a745;">${data.benchmarkRate.toFixed(3)}%</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">Your Threshold</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${data.benchmarkRateThreshold.toFixed(3)}%</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 16px;">This might be a good time to explore refinancing options with lenders.</p>

    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
      <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> This is a benchmark rate. Actual rates will vary by lender and your credit profile. We recommend getting quotes from multiple lenders.</p>
    </div>

    <p style="font-size: 14px; color: #666;">You can adjust your threshold or pause monitoring in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/status" style="color: #000000;">dashboard</a>.</p>
  </div>

  <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
    <p>🐄 Popis Interest Rates - Mortgage Rate Monitoring</p>
    <p>Data source: Optimal Blue 30-Year Fixed Rate Mortgage Index (FRED)</p>
  </div>
</body>
</html>
`;
}

/**
 * Generates plain text version of the alert
 */
function generateAlertEmailText(data: RefinanceAlertData): string {
  return `
Rate Alert!

Hi ${data.userName},

Good news! The benchmark mortgage rate has dropped to a level you were watching.

Rate Update:
- Your Current Rate: ${data.currentRate.toFixed(3)}%
- Current Benchmark Rate: ${data.benchmarkRate.toFixed(3)}%
- Your Threshold: ${data.benchmarkRateThreshold.toFixed(3)}%

This might be a good time to explore refinancing options with lenders.

Note: This is a benchmark rate. Actual rates will vary by lender and your credit profile.

---
Popis Interest Rates - Mortgage Rate Monitoring
Data source: Optimal Blue 30-Year Fixed Rate Mortgage Index (FRED)
`;
}

/**
 * Sends a refinance alert email with deduplication
 * Returns true if email was sent, false if already sent or failed
 */
export async function sendRefinanceAlert(params: {
  sessionId: string;
  to: string;
  data: RefinanceAlertData;
}): Promise<{ sent: boolean; emailId?: string }> {
  const { sessionId, to, data } = params;

  // Create dedupe key based on session
  const dedupeKey = `alert-${sessionId}`;

  // Check if alert already sent for this session
  const existing = await db
    .select()
    .from(alertEvents)
    .where(eq(alertEvents.dedupeKey, dedupeKey))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Alert already sent for session ${sessionId}`);
    return { sent: false };
  }

  const subject = "🐄 Popis Interest Rates: Benchmark Rate Hit Your Target!";
  const html = generateAlertEmailHtml(data);
  const text = generateAlertEmailText(data);

  const provider = getEmailProvider();
  const result = await provider.send({ to, subject, html, text });

  if (!result) {
    console.error("Failed to send alert email");
    return { sent: false };
  }

  // Record the alert event
  await db.insert(alertEvents).values({
    sessionId,
    dedupeKey,
    subject,
    bodyPreview: data.triggeredReason.substring(0, 200),
    emailId: result.id,
  });

  return { sent: true, emailId: result.id };
}

/**
 * Sends a test email to verify email configuration
 */
export async function sendTestEmail(
  to: string,
  userName: string
): Promise<{ sent: boolean; error?: string }> {
  const subject = "🐄 Popis Interest Rates - Test Email";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #000000; padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🐄 Test Email</h1>
  </div>
  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>
    <p style="font-size: 16px;">This is a test email from Popis Interest Rates. If you're seeing this, your email configuration is working correctly!</p>
    <p style="font-size: 14px; color: #666; margin-bottom: 0;">You'll receive alerts at this email address when the benchmark rate hits your threshold.</p>
  </div>
  <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
    <p>🐄 Popis Interest Rates - Mortgage Rate Monitoring</p>
  </div>
</body>
</html>
`;

  const text = `
Test Email

Hi ${userName},

This is a test email from Popis Interest Rates. If you're seeing this, your email configuration is working correctly!

You'll receive alerts at this email address when the benchmark rate hits your threshold.

---
Popis Interest Rates - Mortgage Rate Monitoring
`;

  try {
    const provider = getEmailProvider();
    const result = await provider.send({ to, subject, html, text });

    if (!result) {
      return { sent: false, error: "Email provider returned no result" };
    }

    return { sent: true };
  } catch (error) {
    console.error("Test email error:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
