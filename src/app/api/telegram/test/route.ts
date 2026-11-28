import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDataContext, writeAuditLog } from "@/lib/data-access";
import type { VolunteerDoc } from "@/lib/types";

/**
 * Volunteer-only endpoint to verify Telegram Bot notification delivery
 * through the Vercel serverless function.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Volunteer authentication required." },
      { status: 403 }
    );
  }

  const ctx = await getDataContext();
  let volunteer: VolunteerDoc | null = null;
  if (ctx.db) {
    volunteer = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .findOne({ userId: user.userId });
  } else if (ctx.fallback) {
    volunteer =
      ctx.fallback.volunteers.find((v) => v.userId === user.userId) || null;
  }

  if (!volunteer) {
    return NextResponse.json(
      { error: "Volunteer profile not found." },
      { status: 404 }
    );
  }

  if (!volunteer.telegramChatId) {
    return NextResponse.json(
      {
        sent: false,
        error:
          "Please add your Telegram Chat ID (or link with /start code) first.",
      },
      { status: 400 }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        sent: false,
        error:
          "TELEGRAM_BOT_TOKEN is not configured on the server. Add it to .env.local or Vercel Environment Variables to send live Telegram messages.",
      },
      { status: 400 }
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const text = [
    `🛡️ *HerShield Test Notification*`,
    ``,
    `Hello *${volunteer.displayName}*, your Telegram Chat ID (\`${volunteer.telegramChatId}\`) is working with the HerShield serverless notification service.`,
    ``,
    `*Verification Status:* ${volunteer.verificationStatus}`,
    `*Registered Area:* ${volunteer.registeredArea}`,
    `*Volunteer Portal:* ${appUrl}/volunteer`,
  ].join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: volunteer.telegramChatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      }
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return NextResponse.json(
        {
          sent: false,
          error:
            data.description || `Telegram API rejected request (${res.status})`,
        },
        { status: 502 }
      );
    }

    await writeAuditLog({
      actorId: user.userId,
      actorRole: "volunteer",
      action: "TELEGRAM_TEST_SENT",
      resourceType: "volunteer",
      resourceId: volunteer._id,
      relevantMetadata: { chatId: volunteer.telegramChatId },
    });

    return NextResponse.json({
      sent: true,
      message: `Test Telegram message delivered to Chat ID ${volunteer.telegramChatId}.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        sent: false,
        error:
          err instanceof Error ? err.message : "Failed to contact Telegram API",
      },
      { status: 502 }
    );
  }
}
