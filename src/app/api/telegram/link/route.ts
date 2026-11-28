import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDataContext, writeAuditLog } from "@/lib/data-access";
import {
  fetchTelegramStartCodes,
  getTelegramBotProfile,
  sendTelegramWelcomeMessage,
} from "@/lib/telegram";
import type { VolunteerDoc } from "@/lib/types";

export async function POST() {
  const user = await getSessionUser("volunteer");
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Volunteer session required." },
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

  const bot = await getTelegramBotProfile();

  // If already linked (e.g., via Vercel webhook), confirm immediately
  if (volunteer.telegramChatId) {
    return NextResponse.json({
      linked: true,
      telegramChatId: volunteer.telegramChatId,
      telegramUsername: volunteer.telegramUsername,
      botUsername: bot.username || null,
    });
  }

  if (!bot.configured) {
    return NextResponse.json(
      {
        linked: false,
        error:
          "TELEGRAM_BOT_TOKEN is not configured on the server. Add it to .env.local or Vercel environment variables to enable live Telegram linking.",
      },
      { status: 400 }
    );
  }

  const updates = await fetchTelegramStartCodes();
  if (!updates.ok) {
    if (updates.webhookActive) {
      return NextResponse.json({
        linked: false,
        botUsername: bot.username || null,
        message: `Webhook mode active — tap Start in @${bot.username || "HerShieldnotify_bot"} and wait a moment for the webhook to bind your account.`,
      });
    }
    return NextResponse.json(
      { linked: false, error: updates.error },
      { status: 502 }
    );
  }

  const expectedCode = volunteer.telegramLinkCode.toUpperCase();
  const match = [...updates.matches]
    .reverse()
    .find((m) => m.code === expectedCode);

  if (!match) {
    return NextResponse.json({
      linked: false,
      botUsername: bot.username || null,
      message: `Waiting for /start ${volunteer.telegramLinkCode} in @${bot.username || "HerShieldnotify_bot"}…`,
    });
  }

  const now = new Date().toISOString();
  if (ctx.db) {
    await ctx.db.collection<VolunteerDoc>("volunteers").updateOne(
      { userId: user.userId },
      {
        $set: {
          telegramChatId: match.chatId,
          telegramUsername: match.username,
          updatedAt: now,
        },
      }
    );
  } else if (ctx.fallback) {
    volunteer.telegramChatId = match.chatId;
    volunteer.telegramUsername = match.username;
    volunteer.updatedAt = now;
  }

  await writeAuditLog({
    actorId: user.userId,
    actorRole: "volunteer",
    action: "TELEGRAM_LINKED",
    resourceType: "volunteer",
    resourceId: volunteer._id,
    relevantMetadata: { telegramUsername: match.username },
  });

  await sendTelegramWelcomeMessage({
    chatId: match.chatId,
    volunteerName: volunteer.displayName,
    registeredArea: volunteer.registeredArea,
    verificationStatus: volunteer.verificationStatus,
  });

  return NextResponse.json({
    linked: true,
    telegramChatId: match.chatId,
    telegramUsername: match.username,
    botUsername: bot.username || null,
  });
}

export async function DELETE() {
  const user = await getSessionUser("volunteer");
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Volunteer session required." },
      { status: 403 }
    );
  }

  const ctx = await getDataContext();
  const now = new Date().toISOString();
  if (ctx.db) {
    await ctx.db.collection<VolunteerDoc>("volunteers").updateOne(
      { userId: user.userId },
      { $set: { telegramChatId: null, telegramUsername: null, updatedAt: now } }
    );
  } else if (ctx.fallback) {
    const vol = ctx.fallback.volunteers.find((v) => v.userId === user.userId);
    if (vol) {
      vol.telegramChatId = null;
      vol.telegramUsername = null;
      vol.updatedAt = now;
    }
  }

  return NextResponse.json({ ok: true });
}
