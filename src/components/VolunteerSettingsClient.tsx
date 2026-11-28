"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, MapPin, MessageCircle, RefreshCw, Unlink } from "lucide-react";
import { DEMO_LOCATION_PRESETS, type VolunteerDoc } from "@/lib/types";

export function VolunteerSettingsClient() {
  const [volunteer, setVolunteer] = useState<VolunteerDoc | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [areaPresetId, setAreaPresetId] = useState(DEMO_LOCATION_PRESETS[0].id);
  const [manualChatId, setManualChatId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [res, botRes] = await Promise.all([
      fetch("/api/volunteers/me", { cache: "no-store" }),
      fetch("/api/telegram/bot-info", { cache: "no-store" }).catch(() => null),
    ]);
    if (res.ok) {
      const data = await res.json();
      setVolunteer(data.volunteer);
      if (data.volunteer?.telegramChatId) {
        setManualChatId(data.volunteer.telegramChatId);
      }
      const match = DEMO_LOCATION_PRESETS.find((p) =>
        data.volunteer?.registeredArea?.includes(p.areaName)
      );
      if (match) setAreaPresetId(match.id);
    }
    if (botRes && botRes.ok) {
      const bData = await botRes.json();
      if (bData.username) setBotUsername(bData.username);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function handleSaveArea(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const preset = DEMO_LOCATION_PRESETS.find((p) => p.id === areaPresetId);
    const res = await fetch("/api/volunteers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areaPresetId,
        registeredArea: preset?.areaName,
        lng: preset?.lng,
        lat: preset?.lat,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Registered usual area updated for geospatial alert matching.");
      await load();
    } else {
      setErr("Unable to update registered area.");
    }
  }

  async function handleVerifyTelegramBot() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/telegram/link", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (res.ok && data.linked) {
      setMsg(
        `Telegram linked successfully! Chat ID ${data.telegramChatId} bound to your volunteer profile.`
      );
      await load();
    } else {
      setErr(data.message || data.error || "Telegram link not detected yet.");
    }
  }

  async function handleSaveManualChatId(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/volunteers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramChatId: manualChatId.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Telegram chat ID updated.");
      await load();
    } else {
      setErr("Failed to update Telegram chat ID.");
    }
  }

  async function handleUnlink() {
    setBusy(true);
    await fetch("/api/telegram/link", { method: "DELETE" });
    setManualChatId("");
    setBusy(false);
    await load();
  }

  if (!volunteer) {
    return (
      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-8 text-sm text-[#A99CAF]">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#F8F2F7]">
          Volunteer Profile &amp; Telegram Linking
        </h2>
        <p className="mt-1 text-sm text-[#A99CAF]">
          Manage your registered usual locality and link your Telegram account
          to receive authenticated incident notifications.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-[#005236] bg-[#005236]/50 px-4 py-3 text-xs font-medium text-[#6FFBBE]">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-[#653E00] bg-[#653E00]/40 px-4 py-3 text-xs font-medium text-[#FFDDB8]">
          {err}
        </div>
      )}

      <form
        onSubmit={handleSaveArea}
        className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4"
      >
        <div className="flex items-center gap-2 font-heading text-base font-semibold">
          <MapPin className="h-4 w-4 text-[#D946A8]" />
          Registered Usual Area (MongoDB 2dsphere)
        </div>
        <select
          value={areaPresetId}
          onChange={(e) => setAreaPresetId(e.target.value)}
          className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2.5 text-sm text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
        >
          {DEMO_LOCATION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.areaName} — {p.city}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#D946A8] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#c13592] cursor-pointer"
        >
          Save Registered Area
        </button>
      </form>

      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-heading text-base font-semibold">
            <MessageCircle className="h-4 w-4 text-[#BEA3E4]" />
            Telegram Bot Notification Link
          </div>
          {volunteer.telegramChatId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#005236] px-3 py-1 text-xs font-medium text-[#6FFBBE]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Linked
            </span>
          )}
        </div>

        <div className="rounded-xl bg-[#241C2E] p-4 text-xs space-y-2 border border-[#3D2B35]">
          <p className="font-medium text-[#F8F2F7]">
            Step 1: Open your HerShield Telegram Bot and send the command:
          </p>
          <div className="rounded-lg bg-[#120B1B] border border-[#3D2B35] px-3.5 py-2.5 font-mono text-sm text-[#FFAEDA]">
            /start {volunteer.telegramLinkCode}
          </div>
          <p className="text-[#A99CAF]">
            Step 2: Click &ldquo;Verify Telegram Link&rdquo; below to securely
            bind your Telegram Chat ID via the Bot API.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}?start=${volunteer.telegramLinkCode}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#D946A8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c13592]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open @{botUsername} in Telegram
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleVerifyTelegramBot}
            className="inline-flex items-center gap-2 rounded-lg border border-[#3D2B35] bg-[#38203F] px-4 py-2.5 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Verify Telegram Link
          </button>
          {volunteer.telegramChatId && (
            <button
              type="button"
              disabled={busy}
              onClick={handleUnlink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#93000A] bg-[#93000A]/30 px-4 py-2.5 text-xs font-semibold text-[#FFDAD6] hover:bg-[#93000A] cursor-pointer"
            >
              <Unlink className="h-3.5 w-3.5" />
              Unlink Telegram
            </button>
          )}
        </div>

        <form
          onSubmit={handleSaveManualChatId}
          className="border-t border-[#3D2B35] pt-4 space-y-2"
        >
          <label className="block text-xs font-medium text-[#A99CAF]">
            Or enter Telegram Chat ID directly (for hackathon demo testing):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualChatId}
              onChange={(e) => setManualChatId(e.target.value)}
              placeholder="e.g., 123456789"
              className="flex-1 rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 font-mono text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#38203F] border border-[#3D2B35] px-4 py-2 text-xs font-semibold text-[#EDDCFF] hover:bg-[#D946A8] hover:text-white cursor-pointer"
            >
              Save Chat ID
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
