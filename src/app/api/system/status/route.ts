import { NextResponse } from "next/server";
import { getDataContext } from "@/lib/data-access";
import { getTelegramBotProfile } from "@/lib/telegram";

export async function GET() {
  const ctx = await getDataContext();
  const telegram = await getTelegramBotProfile();
  const aiUrl = process.env.AI_SERVICE_URL?.trim() || "http://127.0.0.1:8000";

  let aiHealth: {
    online: boolean;
    device?: string;
    gpuName?: string | null;
    fps?: number;
    running?: boolean;
    error?: string;
  } = { online: false };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${aiUrl}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      aiHealth = { online: true, ...data };
    } else {
      aiHealth = { online: false, error: `HTTP ${res.status}` };
    }
  } catch {
    aiHealth = {
      online: false,
      error: "Local AI service offline (start ai-service on port 8000)",
    };
  }

  return NextResponse.json({
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
    telegram,
    aiService: {
      url: aiUrl,
      ...aiHealth,
    },
  });
}
