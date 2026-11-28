"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Loader2,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { HerShieldLogo } from "@/components/HerShieldLogo";
import { DEMO_LOCATION_PRESETS } from "@/lib/types";

export default function VolunteerRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [areaPresetId, setAreaPresetId] = useState(DEMO_LOCATION_PRESETS[0].id);
  const [docName, setDocName] = useState("demo-volunteer-id-placeholder.txt");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Telegram bot connection state
  const [step, setStep] = useState<"form" | "telegram">("form");
  const [linkCode, setLinkCode] = useState<string>("");
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [polling, setPolling] = useState<boolean>(false);
  const [linkedInfo, setLinkedInfo] = useState<{
    chatId: string;
    username: string | null;
  } | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/telegram/bot-info", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.username) setBotUsername(d.username);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "telegram" || !polling || linkedInfo) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/link", { method: "POST" });
        const data = await res.json();
        if (res.ok && data.linked) {
          setLinkedInfo({
            chatId: data.telegramChatId,
            username: data.telegramUsername || null,
          });
          setPolling(false);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(timer);
  }, [step, polling, linkedInfo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const preset = DEMO_LOCATION_PRESETS.find((p) => p.id === areaPresetId);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          areaPresetId,
          registeredArea: preset?.areaName,
          lng: preset?.lng,
          lat: preset?.lat,
          consentAccepted,
          documentName: docName,
          documentLabel: "Simulated Volunteer Verification Document (Demo)",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        setLoading(false);
        return;
      }
      setLinkCode(data.volunteer.telegramLinkCode);
      setStep("telegram");
      setPolling(true);
      setLoading(false);
    } catch {
      setError("Network error during registration.");
      setLoading(false);
    }
  }

  async function handleManualVerify() {
    setError(null);
    const res = await fetch("/api/telegram/link", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.linked) {
      setLinkedInfo({
        chatId: data.telegramChatId,
        username: data.telegramUsername || null,
      });
      setPolling(false);
    } else {
      setError(
        data.message ||
          data.error ||
          "Not detected yet — click Open Telegram Bot and press Start in Telegram."
      );
    }
  }

  async function handleSendTestAlert() {
    setTestMsg(null);
    const res = await fetch("/api/telegram/test", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.sent) {
      setTestMsg(data.message);
    } else {
      setError(data.error || "Could not send test notification.");
    }
  }

  const telegramDeepLink = botUsername
    ? `https://t.me/${botUsername}?start=${linkCode}`
    : null;

  return (
    <div className="min-h-screen hs-gradient-hero flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[#3D2B35] bg-[#211829] p-7 shadow-2xl text-[#F8F2F7]">
        <div className="mb-5 flex items-center justify-between">
          <HerShieldLogo subtitle="Volunteer Onboarding" />
          <span className="rounded-full bg-[#38203F] border border-[#3D2B35] px-3 py-1 text-[11px] font-semibold text-[#EDDCFF]">
            {step === "form" ? "Step 1 of 2" : "Step 2 of 2 • Telegram"}
          </span>
        </div>

        {step === "form" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold">
              Register &amp; Connect Telegram
            </h1>
            <p className="mt-1 text-sm text-[#A99CAF]">
              Create your volunteer account, then open the HerShield Telegram
              bot chat to activate instant safety alerts.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#A99CAF]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kavita Rao"
                    className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2.5 text-sm text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#A99CAF]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kavita@example.com"
                    className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2.5 text-sm text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#A99CAF]">
                  Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2.5 text-sm text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#A99CAF]">
                  <MapPin className="h-3.5 w-3.5 text-[#D946A8]" />
                  Registered Usual Area (Approximate Zone)
                </label>
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
                <p className="mt-1 text-[11px] text-[#A99CAF]">
                  Stored as a GeoJSON Point for MongoDB 2dsphere proximity
                  matching. Exact home addresses are never exposed.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-[#3D2B35] bg-[#241C2E] p-3.5">
                <label className="flex items-center gap-2 text-xs font-medium text-[#F8F2F7]">
                  <Upload className="h-4 w-4 text-[#BEA3E4]" />
                  Verification Document (Hackathon Demo Placeholder)
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setDocName(file.name);
                  }}
                  className="mt-2 block w-full text-xs text-[#A99CAF] file:mr-3 file:rounded-md file:border file:border-[#3D2B35] file:bg-[#38203F] file:px-3 py-1.5 file:text-xs file:font-medium file:text-[#EDDCFF]"
                />
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#A99CAF]">
                  <FileCheck className="h-3.5 w-3.5 text-[#4EDEA3]" />
                  Selected reference:{" "}
                  <span className="font-mono text-[#F8F2F7]">{docName}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#FFB95F]">
                  Demo notice: Uploaded reference is used only for simulated
                  administrator review. No real criminal background check is
                  performed.
                </p>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-[#3D2B35] bg-[#241C2E] p-3 text-xs text-[#A99CAF]">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D946A8]"
                />
                <span>
                  I understand that HerShield volunteers act as supportive
                  community bystanders, must never confront armed or violent
                  individuals, and should contact official emergency services
                  (112) when needed.
                </span>
              </label>

              {error && (
                <div className="rounded-lg border border-[#93000A] bg-[#93000A]/40 px-3.5 py-2.5 text-xs font-medium text-[#FFDAD6]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#D946A8] py-3 text-sm font-semibold text-white hover:bg-[#c13592] disabled:opacity-60 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                {loading
                  ? "Creating Account…"
                  : "Continue to Telegram Bot Setup"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-[#A99CAF]">
              Already registered?{" "}
              <Link
                href="/volunteer/login"
                className="font-semibold text-[#FFAEDA] hover:underline"
              >
                Sign in to Volunteer Portal
              </Link>
            </p>
          </>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="font-heading text-2xl font-semibold">
                Connect Telegram Notification Bot
              </h1>
              <p className="mt-1 text-sm text-[#A99CAF]">
                Open the HerShield bot chat in Telegram and press{" "}
                <strong className="text-[#F8F2F7]">Start</strong>. The
                notification system will activate automatically.
              </p>
            </div>

            {!linkedInfo ? (
              <div className="space-y-4 rounded-xl border border-[#3D2B35] bg-[#241C2E] p-5">
                <div className="text-xs text-[#A99CAF]">
                  Your personal Telegram verification command:
                </div>
                <div className="rounded-lg border border-[#3D2B35] bg-[#120B1B] px-3.5 py-2.5 font-mono text-sm text-[#FFAEDA]">
                  /start {linkCode}
                </div>

                {telegramDeepLink ? (
                  <a
                    href={telegramDeepLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setPolling(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D946A8] py-3.5 text-sm font-semibold text-white hover:bg-[#c13592] transition"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Open @{botUsername} in Telegram
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="rounded-lg border border-[#653E00] bg-[#653E00]/40 p-3 text-xs text-[#FFDDB8]">
                    Bot username not detected yet. Ensure{" "}
                    <code>TELEGRAM_BOT_TOKEN</code> is loaded in{" "}
                    <code>.env.local</code> and server restarted.
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-xs text-[#BEA3E4]">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D946A8]" />
                    Waiting for you to press Start in Telegram…
                  </span>
                  <button
                    type="button"
                    onClick={handleManualVerify}
                    className="rounded-md border border-[#3D2B35] bg-[#38203F] px-3 py-1.5 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] cursor-pointer"
                  >
                    Verify Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-[#005236] bg-[#005236]/35 p-5">
                <div className="flex items-center gap-2 text-base font-semibold text-[#6FFBBE]">
                  <CheckCircle2 className="h-5 w-5" />
                  Telegram Notification System Started!
                </div>
                <p className="text-xs text-[#F8F2F7]">
                  Linked Chat ID:{" "}
                  <code className="font-mono text-[#FFAEDA]">
                    {linkedInfo.chatId}
                  </code>
                  {linkedInfo.username ? ` (@${linkedInfo.username})` : ""}. A
                  welcome confirmation has been sent to your Telegram chat.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleSendTestAlert}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#D946A8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c13592] cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Test Notification
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/volunteer");
                      router.refresh();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#211829] px-4 py-2.5 text-xs font-semibold text-[#F8F2F7] hover:border-[#BEA3E4] cursor-pointer"
                  >
                    Go to Volunteer Dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {testMsg && (
              <div className="rounded-lg border border-[#005236] bg-[#005236]/50 px-3.5 py-2.5 text-xs text-[#6FFBBE]">
                {testMsg}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-[#653E00] bg-[#653E00]/40 px-3.5 py-2.5 text-xs text-[#FFDDB8]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-[#3D2B35] pt-3 text-xs text-[#A99CAF]">
              <span>Verification Status: Submitted (Admin review pending)</span>
              <Link
                href="/volunteer"
                className="font-semibold text-[#BEA3E4] hover:text-[#FFAEDA]"
              >
                Skip for now →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
