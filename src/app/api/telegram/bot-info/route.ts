import { NextResponse } from "next/server";
import { getTelegramBotProfile } from "@/lib/telegram";

export async function GET() {
  const bot = await getTelegramBotProfile();
  return NextResponse.json({
    configured: bot.configured,
    username: bot.username || process.env.TELEGRAM_BOT_USERNAME?.trim() || null,
    firstName: bot.firstName || null,
    error: bot.error || null,
  });
}
