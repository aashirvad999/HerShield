import "server-only";
import { INCIDENT_TYPE_LABELS, type IncidentDoc } from "./types";

export interface TelegramSendResult {
  status: "sent" | "failed" | "not_linked" | "telegram_unconfigured";
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

export async function getTelegramBotProfile(): Promise<{
  configured: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      configured: false,
      error: "TELEGRAM_BOT_TOKEN is not set in server environment variables.",
    };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        configured: true,
        error: data.description || `Telegram API error (${res.status})`,
      };
    }
    return {
      configured: true,
      username: data.result?.username,
      firstName: data.result?.first_name,
    };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : "Telegram API unreachable",
    };
  }
}

export async function sendTelegramWelcomeMessage(params: {
  chatId: string;
  volunteerName: string;
  registeredArea: string;
  verificationStatus: string;
}): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      status: "telegram_unconfigured",
      error: "TELEGRAM_BOT_TOKEN is not configured.",
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const statusLine =
    params.verificationStatus === "Verified"
      ? "✅ You are verified and eligible to receive nearby community safety alerts (PrivacyShield skeletal previews only)."
      : "⏳ Once an Administrator approves your application in the Admin Portal, you will automatically begin receiving nearby safety alerts.";

  const text = [
    `🛡️ <b>HerShield Notification System Active!</b>`,
    ``,
    `Welcome, <b>${escapeHtml(params.volunteerName)}</b>. Your Telegram account (Chat ID: <code>${escapeHtml(params.chatId)}</code>) is now connected to HerShield.`,
    ``,
    `<b>Registered Area:</b> ${escapeHtml(params.registeredArea)}`,
    `<b>Verification Status:</b> ${escapeHtml(params.verificationStatus)}`,
    ``,
    statusLine,
    ``,
    `Open Volunteer Portal: ${escapeHtml(`${appUrl}/volunteer`)}`,
  ].join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: params.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return {
        status: "failed",
        error: data.description || `HTTP ${res.status}`,
      };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Network error calling Telegram",
    };
  }
}

export async function sendVolunteerIncidentAlert(params: {
  chatId: string | null;
  incident: IncidentDoc;
  approxDistanceText: string;
}): Promise<TelegramSendResult> {
  if (!params.chatId) {
    return {
      status: "not_linked",
      error: "Volunteer has not linked a Telegram chat ID.",
    };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      status: "telegram_unconfigured",
      error:
        "TELEGRAM_BOT_TOKEN is not configured on the server. Alert logged in portal only.",
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const incidentMeta = INCIDENT_TYPE_LABELS[params.incident.incidentType];
  const alertUrl = `${appUrl}/volunteer/incidents/${params.incident.incidentId}`;

  const text = [
    `🛡️ <b>HerShield Community Safety Alert</b>`,
    ``,
    `<b>Incident ID:</b> <code>${escapeHtml(params.incident.incidentId)}</code>`,
    `<b>Type:</b> ${escapeHtml(incidentMeta?.title || params.incident.incidentTitle)}`,
    `<b>Approx. Location:</b> ${escapeHtml(params.incident.incidentLocation.approxLabel)}`,
    `<b>Distance:</b> ${escapeHtml(params.approxDistanceText)}`,
    `<b>Detected:</b> ${escapeHtml(new Date(params.incident.detectedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}`,
    `<b>Confidence:</b> ${params.incident.incidentConfidence}% (${params.incident.confidenceType === "heuristic" ? "Heuristic Indicator" : "Model Score"})`,
    ``,
    `🔒 <i>PrivacyShield active: no raw footage is shared. Only non-identifying skeletal movement preview is available.</i>`,
    `⚠️ <i>Safety note: Observe from a safe distance or contact official emergency services (112) if needed. Never confront suspects directly.</i>`,
    ``,
    `👉 Open Volunteer Portal (login required): ${escapeHtml(alertUrl)}`,
  ].join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: params.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ I Can Help",
                  callback_data: `accept:${params.incident.incidentId}`,
                },
                {
                  text: "✖️ Unable to Respond",
                  callback_data: `decline:${params.incident.incidentId}`,
                },
              ],
            ],
          },
        }),
      }
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return {
        status: "failed",
        error: data.description || `HTTP ${res.status}`,
      };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Network error calling Telegram",
    };
  }
}

export async function fetchTelegramStartCodes(): Promise<{
  ok: boolean;
  matches: Array<{ code: string; chatId: string; username: string | null }>;
  webhookActive?: boolean;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      matches: [],
      error: "TELEGRAM_BOT_TOKEN is not configured.",
    };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=50`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as {
      ok: boolean;
      error_code?: number;
      result?: Array<{
        message?: {
          text?: string;
          chat?: { id: number; username?: string };
        };
      }>;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        matches: [],
        webhookActive: data.error_code === 409,
        error: data.description || "Failed to fetch Telegram updates",
      };
    }
    const matches: Array<{
      code: string;
      chatId: string;
      username: string | null;
    }> = [];
    for (const upd of data.result || []) {
      const text = upd.message?.text?.trim() || "";
      const chat = upd.message?.chat;
      if (!chat) continue;
      const m = text.match(/^\/start\s+([A-Za-z0-9_-]+)/i);
      if (m) {
        matches.push({
          code: m[1].toUpperCase(),
          chatId: String(chat.id),
          username: chat.username || null,
        });
      }
    }
    return { ok: true, matches };
  } catch (err) {
    return {
      ok: false,
      matches: [],
      error: err instanceof Error ? err.message : "Telegram polling error",
    };
  }
}
