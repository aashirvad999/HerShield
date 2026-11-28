import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getTelegramBotProfile } from "@/lib/telegram";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const profile = await getTelegramBotProfile();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  let webhookInfo: {
    url?: string;
    pendingUpdateCount?: number;
    lastErrorMessage?: string;
  } | null = null;

  if (token) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/getWebhookInfo`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        ok: boolean;
        result?: {
          url?: string;
          pending_update_count?: number;
          last_error_message?: string;
        };
      };
      if (data.ok && data.result) {
        webhookInfo = {
          url: data.result.url || "",
          pendingUpdateCount: data.result.pending_update_count ?? 0,
          lastErrorMessage: data.result.last_error_message,
        };
      }
    } catch {
      webhookInfo = null;
    }
  }

  return NextResponse.json({
    bot: profile,
    webhook: webhookInfo,
    recommendedWebhookUrl: `${
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://your-app.vercel.app"
    }/api/telegram/webhook`,
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "TELEGRAM_BOT_TOKEN is not configured on the server. Add it in Vercel Environment Variables first.",
      },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    webhookUrl?: string;
  };
  const targetUrl =
    body.webhookUrl?.trim() ||
    `${process.env.NEXT_PUBLIC_APP_URL?.trim() || ""}/api/telegram/webhook`;

  if (!targetUrl.startsWith("https://")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Telegram webhooks require an HTTPS URL (e.g., https://your-project.vercel.app/api/telegram/webhook). For localhost, volunteers can use 'Verify Telegram Link' or enter their Chat ID directly.",
      },
      { status: 400 }
    );
  }

  const payload: Record<string, string> = { url: targetUrl };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    payload.secret_token = secret;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };

  if (!res.ok || !data.ok) {
    return NextResponse.json(
      { ok: false, error: data.description || "setWebhook failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, webhookUrl: targetUrl });
}
