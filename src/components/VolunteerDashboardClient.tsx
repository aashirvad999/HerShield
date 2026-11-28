"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  ExternalLink,
  MapPin,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { VerificationBadge } from "./StatusBadges";
import type {
  VerificationStatus,
  VolunteerApplicationDoc,
  VolunteerDoc,
} from "@/lib/types";

interface VolunteerNotificationRow {
  incidentId: string;
  approxDistanceText: string;
  telegramStatus: string;
  notificationSentAt: string;
  acknowledgementStatus: "pending" | "accepted" | "declined";
  acknowledgedAt: string | null;
  incident: {
    incidentId: string;
    incidentTitle: string;
    approxLocation: string;
    incidentConfidence: number;
    confidenceType: string;
    detectedAt: string;
  } | null;
}

export function VolunteerDashboardClient() {
  const [volunteer, setVolunteer] = useState<VolunteerDoc | null>(null);
  const [application, setApplication] =
    useState<VolunteerApplicationDoc | null>(null);
  const [notifications, setNotifications] = useState<
    VolunteerNotificationRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [docName, setDocName] = useState("");
  const [telegramIdInput, setTelegramIdInput] = useState("");
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [busyTelegram, setBusyTelegram] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const [meRes, botRes] = await Promise.all([
      fetch("/api/volunteers/me", { cache: "no-store" }),
      fetch("/api/telegram/bot-info", { cache: "no-store" }).catch(() => null),
    ]);
    if (meRes.ok) {
      const data = await meRes.json();
      setVolunteer(data.volunteer);
      setTelegramIdInput(data.volunteer?.telegramChatId || "");
      setApplication(data.application);
      setNotifications(data.notifications || []);
    }
    if (botRes && botRes.ok) {
      const bData = await botRes.json();
      if (bData.username) setBotUsername(bData.username);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadMe();
    }, 0);
    return () => clearTimeout(t);
  }, [loadMe]);

  async function handleSaveTelegramId(e: React.FormEvent) {
    e.preventDefault();
    setBusyTelegram(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/volunteers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramChatId: telegramIdInput.trim() }),
      });
      if (res.ok) {
        setStatusMsg(
          telegramIdInput.trim()
            ? `Telegram Chat ID (${telegramIdInput.trim()}) saved to your volunteer profile.`
            : "Telegram Chat ID cleared."
        );
        await loadMe();
      } else {
        setErrorMsg("Unable to save Telegram Chat ID.");
      }
    } finally {
      setBusyTelegram(false);
    }
  }

  async function handleVerifyTelegramBot() {
    setBusyTelegram(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.linked) {
        setStatusMsg(
          `Telegram linked! Chat ID ${data.telegramChatId} connected and welcome alert sent.`
        );
        await loadMe();
      } else {
        setErrorMsg(
          data.message ||
            data.error ||
            "Not detected yet — click Open Telegram Bot and tap Start."
        );
      }
    } finally {
      setBusyTelegram(false);
    }
  }

  async function handleSendTestTelegram() {
    setBusyTelegram(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.sent) {
        setStatusMsg(data.message);
      } else {
        setErrorMsg(data.error || "Unable to send test Telegram notification.");
      }
    } finally {
      setBusyTelegram(false);
    }
  }

  async function handleDocUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!docName.trim()) return;
    setStatusMsg(null);
    setErrorMsg(null);
    const res = await fetch("/api/volunteers/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentName: docName.trim(),
        documentLabel: "Updated Demo Verification Document Placeholder",
      }),
    });
    if (res.ok) {
      setStatusMsg(
        "Demo verification document reference attached to your application."
      );
      setDocName("");
      await loadMe();
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-8 text-sm text-[#A99CAF]">
        Loading volunteer profile…
      </div>
    );
  }

  if (!volunteer) {
    return (
      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-8 text-sm text-[#A99CAF]">
        Volunteer profile not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#F8F2F7]">
            Community Volunteer Dashboard
          </h2>
          <p className="text-sm text-[#A99CAF]">
            Add your Telegram Chat ID to receive instant safety alerts with
            non-identifying PrivacyShield skeletal previews.
          </p>
        </div>

        <Link
          href="/volunteer/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-4 py-2.5 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4]"
        >
          <MessageCircle className="h-4 w-4 text-[#D946A8]" />
          Area &amp; Bot Link Settings
        </Link>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-[#005236] bg-[#005236]/50 px-4 py-3 text-xs font-medium text-[#6FFBBE]">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#653E00] bg-[#653E00]/40 px-4 py-3 text-xs font-medium text-[#FFDDB8]">
          {errorMsg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Verification Status</span>
            <ShieldCheck className="h-4 w-4 text-[#4EDEA3]" />
          </div>
          <div className="pt-1">
            <VerificationBadge
              status={volunteer.verificationStatus as VerificationStatus}
            />
          </div>
          <p className="text-xs text-[#A99CAF]">
            {volunteer.alertEligible
              ? "Approved & eligible to receive nearby incident alerts."
              : "Alerts remain disabled until an administrator manually approves your application."}
          </p>
        </div>

        <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Registered Usual Area</span>
            <MapPin className="h-4 w-4 text-[#D946A8]" />
          </div>
          <div className="font-heading text-base font-semibold text-[#F8F2F7]">
            {volunteer.registeredArea}
          </div>
          <p className="text-xs text-[#A99CAF]">
            No continuous live GPS tracking is used.
          </p>
        </div>

        <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Telegram Alerts</span>
            <MessageCircle className="h-4 w-4 text-[#BEA3E4]" />
          </div>
          <div className="font-heading text-base font-semibold text-[#F8F2F7]">
            {volunteer.telegramChatId ? "Connected" : "Not Linked Yet"}
          </div>
          <p className="text-xs text-[#A99CAF]">
            {volunteer.telegramChatId
              ? `Chat ID: ${volunteer.telegramChatId}${volunteer.telegramUsername ? ` (@${volunteer.telegramUsername})` : ""}`
              : `Bot link code: ${volunteer.telegramLinkCode}`}
          </p>
        </div>
      </div>

      {/* Volunteer-Only Telegram ID Setup & Serverless Test Card */}
      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-heading text-base font-semibold text-[#F8F2F7] flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#D946A8]" />
              Connect Your Telegram ID (Volunteers Only)
            </h3>
            <p className="text-xs text-[#A99CAF] mt-0.5">
              Open the HerShield Telegram bot and press Start, or enter your
              numeric Chat ID directly to activate notifications.
            </p>
          </div>
          {botUsername && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://t.me/${botUsername}?start=${volunteer.telegramLinkCode}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D946A8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#c13592]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Open @{botUsername} in Telegram
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                disabled={busyTelegram}
                onClick={handleVerifyTelegramBot}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#38203F] px-3.5 py-2 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Verify Bot Link
              </button>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSaveTelegramId}
          className="flex flex-wrap items-center gap-2.5"
        >
          <input
            type="text"
            value={telegramIdInput}
            onChange={(e) => setTelegramIdInput(e.target.value)}
            placeholder="Enter your Telegram Chat ID (e.g. 5829104321)"
            className="flex-1 min-w-[240px] rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2.5 font-mono text-xs text-[#F8F2F7] placeholder-[#7E7388] outline-none focus:border-[#BEA3E4]"
          />
          <button
            type="submit"
            disabled={busyTelegram}
            className="rounded-lg bg-[#D946A8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c13592] disabled:opacity-60 cursor-pointer"
          >
            Save Telegram ID
          </button>
          <button
            type="button"
            disabled={busyTelegram || !volunteer.telegramChatId}
            onClick={handleSendTestTelegram}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#38203F] px-4 py-2.5 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            Send Test Notification
          </button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4 lg:col-span-7">
          <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-[#F8F2F7]">
            <BellRing className="h-5 w-5 text-[#D946A8]" />
            Recent Incident Alerts &amp; Response History
          </h3>

          {notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#3D2B35] p-6 text-center text-xs text-[#A99CAF]">
              No incident alerts dispatched to your area yet.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <Link
                  key={`${n.incidentId}-${n.notificationSentAt}`}
                  href={`/volunteer/incidents/${n.incidentId}`}
                  className="block rounded-xl border border-[#3D2B35] bg-[#241C2E] p-4 hover:border-[#BEA3E4] transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-heading text-sm font-semibold text-[#F8F2F7]">
                        {n.incident?.incidentTitle || n.incidentId}
                      </div>
                      <div className="mt-1 text-xs text-[#A99CAF]">
                        {n.incident?.approxLocation || "Approximate area"} •{" "}
                        <span className="font-mono font-semibold text-[#FFAEDA] tabular-nums">
                          {n.approxDistanceText}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-[#A99CAF]" />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-semibold uppercase text-[10px] ${
                        n.acknowledgementStatus === "accepted"
                          ? "bg-[#005236] text-[#6FFBBE]"
                          : n.acknowledgementStatus === "declined"
                            ? "bg-[#93000A] text-[#FFDAD6]"
                            : "bg-[#653E00] text-[#FFDDB8]"
                      }`}
                    >
                      Your Response: {n.acknowledgementStatus}
                    </span>
                    <span className="font-mono text-[11px] text-[#A99CAF] tabular-nums">
                      {new Date(n.notificationSentAt).toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4 lg:col-span-5">
          <h3 className="font-heading text-base font-semibold text-[#F8F2F7]">
            Application &amp; Verification Record
          </h3>
          {application && (
            <div className="space-y-2 rounded-xl border border-[#3D2B35] bg-[#241C2E] p-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#A99CAF]">Application Status</span>
                <VerificationBadge status={application.applicationStatus} />
              </div>
              <div className="text-[#A99CAF] pt-1">
                <strong className="text-[#F8F2F7]">Review Notes:</strong>{" "}
                {application.reviewNotes}
              </div>
              <div className="pt-2">
                <div className="font-semibold text-[#BEA3E4]">
                  Submitted Document References (Demo):
                </div>
                <ul className="mt-1 space-y-1">
                  {application.documentReferences.map((d) => (
                    <li
                      key={d.docId}
                      className="flex items-center gap-1.5 text-[11px] text-[#A99CAF]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#4EDEA3]" />
                      <span className="font-mono text-[#F8F2F7]">
                        {d.fileName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <form onSubmit={handleDocUpload} className="space-y-2.5 pt-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#BEA3E4]">
              <Upload className="h-3.5 w-3.5 text-[#D946A8]" />
              Attach Additional Demo Verification Document
            </label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setDocName(file.name);
              }}
              className="block w-full text-xs text-[#A99CAF] file:mr-3 file:rounded-md file:border file:border-[#3D2B35] file:bg-[#38203F] file:px-3 py-1.5 file:text-xs file:font-medium file:text-[#EDDCFF]"
            />
            <button
              type="submit"
              disabled={!docName}
              className="w-full rounded-lg bg-[#38203F] border border-[#3D2B35] py-2 text-xs font-semibold text-[#EDDCFF] hover:bg-[#D946A8] hover:text-white disabled:opacity-50 cursor-pointer"
            >
              Upload Placeholder Reference
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
