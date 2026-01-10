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
    this.from = process.env.EMAIL_FROM || "Refi Radar <alerts@refi-radar.com>";
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
  benchmarkRateThreshold?: number;
  estimatedNewRate: number;
  monthlySavings: number;
  breakEvenMonths: number;
  breakEvenThreshold?: number;
  triggeredReason: string;
}

/**
 * Generates the alert email HTML
 */
function generateAlertEmailHtml(data: RefinanceAlertData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refinance Alert</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Time to Refinance!</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px; margin-top: 0;">Hi ${data.userName},</p>

    <p style="font-size: 16px;">Great news! Based on your refinance criteria, <strong>now may be a good time to shop for a new mortgage</strong>.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Why We're Alerting You</h3>
      <p style="margin-bottom: 0;">${data.triggeredReason}</p>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Rate Comparison</h3>
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
          <td style="padding: 8px 0;">Estimated Monthly Savings</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #28a745;">$${data.monthlySavings.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Break-Even Analysis</h3>
      <p style="margin-bottom: 0;">Based on your closing cost estimate, you would break even on refinancing costs in approximately <strong>${data.breakEvenMonths} months</strong>.</p>
    </div>

    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;">
      <p style="margin: 0; font-size: 14px;"><strong>⚠️ Important:</strong> These are estimates based on benchmark rates. Actual rates and costs will vary by lender. We recommend getting quotes from multiple lenders before making a decision.</p>
    </div>

    <p style="font-size: 14px; color: #666;">This alert was triggered by your Refi Radar monitoring settings. You can adjust your thresholds or pause monitoring in your <a href="${process.env.NEXT_PUBLIC_APP_URL}/status" style="color: #667eea;">dashboard</a>.</p>
  </div>

  <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
    <p>Refi Radar - Mortgage Refinance Monitoring</p>
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
Time to Refinance!

Hi ${data.userName},

Great news! Based on your refinance criteria, now may be a good time to shop for a new mortgage.

Why We're Alerting You:
${data.triggeredReason}

Rate Comparison:
- Your Current Rate: ${data.currentRate.toFixed(3)}%
- Current Benchmark Rate: ${data.benchmarkRate.toFixed(3)}%
- Estimated Monthly Savings: $${data.monthlySavings.toFixed(2)}

Break-Even Analysis:
Based on your closing cost estimate, you would break even on refinancing costs in approximately ${data.breakEvenMonths} months.

Important: These are estimates based on benchmark rates. Actual rates and costs will vary by lender.

---
Refi Radar - Mortgage Refinance Monitoring
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

  const subject = "🎯 Refi Radar Alert: Time to Shop for a Refinance!";
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
