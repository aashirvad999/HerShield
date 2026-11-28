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
    <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-heading text-sm font-semibold text-[#F8F2F7]">
          <MessageCircle className="h-4 w-4 text-[#BEA3E4]" />
          Vercel Serverless Telegram Bot Webhook
        </div>
        {info?.bot?.username && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#005236] px-2.5 py-0.5 text-xs font-medium text-[#6FFBBE]">
            <CheckCircle2 className="h-3 w-3" />@{info.bot.username}
          </span>
        )}
      </div>

      <p className="text-xs text-[#A99CAF]">
        Incoming commands (<code>/start &lt;code&gt;</code>, <code>/id</code>)
        and inline button callbacks route to{" "}
        <code className="text-[#EDDCFF]">/api/telegram/webhook</code> as a
        Vercel serverless function.
      </p>

      {info?.webhook?.url && (
        <div className="rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3 text-xs">
          <div className="text-[#A99CAF]">Active Webhook URL:</div>
          <div className="mt-0.5 font-mono text-[#6FFBBE] break-all">
            {info.webhook.url}
          </div>
          {info.webhook.lastErrorMessage && (
            <div className="mt-1 text-[#FFB95F]">
              Last Telegram delivery note: {info.webhook.lastErrorMessage}
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className="rounded-lg border border-[#005236] bg-[#005236]/50 px-3 py-2 text-xs text-[#6FFBBE]">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-[#653E00] bg-[#653E00]/40 px-3 py-2 text-xs text-[#FFDDB8]">
          {err}
        </div>
      )}

      <form onSubmit={handleRegisterWebhook} className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Globe className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#A99CAF]" />
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-app.vercel.app/api/telegram/webhook"
            className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] py-2 pl-8 pr-3 font-mono text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#D946A8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c13592] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Register Vercel Webhook
        </button>
      </form>
    </div>
  );
}
