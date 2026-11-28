import { NextResponse } from "next/server";
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/telegram-updates";

/**
 * Vercel Serverless Telegram Webhook Handler
 * Receives Telegram Bot updates (e.g. /start HS-VOL-..., /id, inline callbacks, or text replies)
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const provided = request.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    const outcome = await processTelegramUpdate(update);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
