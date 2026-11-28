"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Globe, MessageCircle, RefreshCw } from "lucide-react";

interface WebhookSetupState {
  bot?: { configured: boolean; username?: string; error?: string };
  webhook?: { url?: string; pendingUpdateCount?: number; lastErrorMessage?: string } | null;
  recommendedWebhookUrl?: string;
}

export function AdminTelegramConfigClient() {
  const [info, setInfo] = useState<WebhookSetupState | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/telegram/setup", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as WebhookSetupState;
      setInfo(data);
      if (data.recommendedWebhookUrl && !webhookUrl) {
        setWebhookUrl(data.recommendedWebhookUrl);
      }
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegisterWebhook(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.ok) {
      setMsg(`Vercel Telegram webhook registered at ${data.webhookUrl}`);
      await refresh();
    } else {
      setErr(data.error || "Unable to register Telegram webhook.");
    }
  }

  return (
    <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-heading text-sm font-semibold text-[#2B1324]">
          <MessageCircle className="h-4 w-4 text-[#DB2777]" />
          Vercel Serverless Telegram Bot Webhook
        </div>
        {info?.bot?.username && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />@{info.bot.username}
          </span>
        )}
      </div>

      <p className="text-xs text-[#7A566E]">
        Incoming commands (<code>/start &lt;code&gt;</code>, <code>/id</code>)
        and inline button callbacks route to{" "}
        <code className="text-[#2B1324]">/api/telegram/webhook</code> as a
        Vercel serverless function.
      </p>

      {info?.webhook?.url && (
        <div className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] p-3 text-xs">
          <div className="text-[#7A566E]">Active Webhook URL:</div>
          <div className="mt-0.5 font-mono text-emerald-700 break-all">
            {info.webhook.url}
          </div>
          {info.webhook.lastErrorMessage && (
            <div className="mt-1 text-amber-600">
              Last Telegram delivery note: {info.webhook.lastErrorMessage}
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-700">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {err}
        </div>
      )}

      <form onSubmit={handleRegisterWebhook} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Globe className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#7A566E]" />
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-app.vercel.app/api/telegram/webhook"
            className="w-full rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] py-2 pl-8 pr-3 font-mono text-xs text-[#2B1324] outline-none focus:border-[#BEA3E4]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#DB2777] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Register Vercel Webhook
        </button>
      </form>
    </div>
  );
}
