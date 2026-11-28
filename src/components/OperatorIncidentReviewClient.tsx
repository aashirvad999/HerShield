"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  MapPin,
  Send,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { PrivacyShieldPlayer } from "./PrivacyShieldPlayer";
import { ConfidenceBadge, IncidentStatusBadge } from "./StatusBadges";
import {
  DEMO_LOCATION_PRESETS,
  INCIDENT_TYPE_LABELS,
  type IncidentDoc,
  type IncidentNotificationDoc,
} from "@/lib/types";

interface EligibleVolunteerRow {
  _id: string;
  displayName: string;
  registeredArea: string;
  verificationStatus: string;
  alertEligible: boolean;
  telegramLinked: boolean;
  distanceMeters: number;
  approxDistanceText: string;
  isSimulatedDemo: boolean;
}

export function OperatorIncidentReviewClient({
  incidentId,
}: {
  incidentId: string;
}) {
  const [incident, setIncident] = useState<IncidentDoc | null>(null);
  const [notifications, setNotifications] = useState<IncidentNotificationDoc[]>(
    []
  );
  const [eligible, setEligible] = useState<EligibleVolunteerRow[]>([]);
  const [selectedVolIds, setSelectedVolIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [confirmDispatchModal, setConfirmDispatchModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    const res = await fetch(`/api/incidents/${incidentId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    setIncident(data.incident);
    setNotifications(data.notifications || []);
    const list: EligibleVolunteerRow[] = data.eligibleVolunteers || [];
    setEligible(list);
    setSelectedVolIds((prev) =>
      prev.length > 0 ? prev : list.map((v) => v._id)
    );
  }, [incidentId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadDetails();
    }, 0);
    const poll = setInterval(() => {
      void loadDetails();
    }, 2500);
    return () => {
      clearTimeout(t);
      clearInterval(poll);
    };
  }, [loadDetails]);

  async function handleAction(
    action: "confirm" | "false_positive" | "close" | "update_location",
    extra?: Record<string, unknown>
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Update failed.");
      } else {
        setIncident(data.incident);
        const list: EligibleVolunteerRow[] = data.eligibleVolunteers || [];
        setEligible(list);
        setSelectedVolIds(list.map((v) => v._id));
        if (action === "update_location") {
          setFeedback(
            `Location updated to ${data.incident.incidentLocation.areaName}. Nearby eligible volunteer recipients recalculated via MongoDB 2dsphere.`
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDispatch() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedVolunteerIds: selectedVolIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Dispatch failed.");
      } else {
        setFeedback(
          `Dispatched alert to ${data.dispatchedCount} verified nearby volunteer(s). Check Telegram delivery status below.`
        );
        await loadDetails();
      }
    } finally {
      setBusy(false);
      setConfirmDispatchModal(false);
    }
  }

  if (!incident) {
    return (
      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-8 text-sm text-[#A99CAF]">
        Loading incident review details…
      </div>
    );
  }

  const meta = INCIDENT_TYPE_LABELS[incident.incidentType];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/operator"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#BEA3E4] hover:text-[#FFAEDA]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Live Monitoring
        </Link>
        <div className="flex items-center gap-2">
          <IncidentStatusBadge status={incident.incidentStatus} />
          <ConfidenceBadge
            score={incident.incidentConfidence}
            type={incident.confidenceType}
          />
        </div>
      </div>

      {incident.autoDispatched && (
        <div className="rounded-xl border border-[#D946A8]/40 bg-[#38203F] px-4 py-3 text-xs font-medium text-[#FFAEDA]">
          <strong>High-Risk Auto-Dispatch Triggered:</strong>{" "}
          {incident.autoDispatchNote ||
            `Risk score (${incident.incidentConfidence}%) exceeded 75%, so verified nearby volunteers were notified automatically.`}
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-[#3D2B35] bg-[#38203F] px-4 py-3 text-xs font-medium text-[#EDDCFF]">
          {feedback}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4">
            <div>
              <div className="font-mono text-xs text-[#BEA3E4]">
                {incident.incidentId} • Source: {incident.cameraSource}
              </div>
              <h2 className="mt-1 font-heading text-2xl font-semibold text-[#F8F2F7]">
                {incident.incidentTitle}
              </h2>
              <p className="mt-2 text-sm text-[#A99CAF]">
                {incident.detectionExplanation}
              </p>
              <p className="mt-2 rounded-lg bg-[#241C2E] p-3 text-xs text-[#A99CAF] border border-[#3D2B35]">
                <strong className="text-[#F8F2F7]">Limitation Note:</strong>{" "}
                {meta?.disclaimer}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3">
                <div className="text-[#A99CAF]">Detected At</div>
                <div className="mt-0.5 font-medium tabular-nums">
                  {new Date(incident.detectedAt).toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3">
                <div className="text-[#A99CAF]">Location</div>
                <div className="mt-0.5 font-medium">
                  {incident.incidentLocation.areaName}
                </div>
              </div>
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3">
                <div className="text-[#A99CAF]">Confirmation</div>
                <div className="mt-0.5 font-medium uppercase text-[#BEA3E4]">
                  {incident.confirmationStatus.replace("_", " ")}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction("confirm")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#005236] px-4 py-2 text-xs font-semibold text-[#6FFBBE] hover:bg-[#006b47] cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Incident
              </button>
              <button
                type="button"
                disabled={busy || eligible.length === 0}
                onClick={() => setConfirmDispatchModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#D946A8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c13592] disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                Dispatch Volunteer Alert ({selectedVolIds.length})
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction("false_positive")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#93000A] px-4 py-2 text-xs font-semibold text-[#FFDAD6] hover:bg-[#b0000d] cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
                Mark False Positive
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction("close")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-4 py-2 text-xs font-semibold text-[#A99CAF] hover:text-white cursor-pointer"
              >
                Close Incident
              </button>
            </div>
          </div>

          <PrivacyShieldPlayer
            incidentId={incident.incidentId}
            frames={incident.sanitizedTimelineFrames}
            previewReference={incident.sanitizedPreviewReference}
            previewSha256={incident.previewSha256}
          />
        </div>

        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-3">
            <div className="flex items-center gap-2 font-heading text-base font-semibold">
              <MapPin className="h-4 w-4 text-[#D946A8]" />
              Incident Location &amp; Geospatial Selection
            </div>
            <p className="text-xs text-[#A99CAF]">
              Change the demonstration incident location to see MongoDB{" "}
              <code className="rounded bg-[#38203F] px-1 text-[#EDDCFF]">
                2dsphere
              </code>{" "}
              recalculate eligible verified volunteers dynamically.
            </p>
            <div className="flex gap-2">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="flex-1 rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
              >
                <option value="">Select new demonstration location…</option>
                {DEMO_LOCATION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.areaName} ({p.city})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedPresetId || busy}
                onClick={() =>
                  handleAction("update_location", {
                    areaPresetId: selectedPresetId,
                  })
                }
                className="rounded-lg bg-[#38203F] border border-[#3D2B35] px-3.5 py-2 text-xs font-semibold text-[#EDDCFF] hover:bg-[#D946A8] hover:text-white disabled:opacity-50 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-heading text-base font-semibold">
                <UserCheck className="h-4 w-4 text-[#4EDEA3]" />
                Eligible Nearby Volunteers ({eligible.length})
              </div>
              <span className="text-[11px] text-[#A99CAF]">Verified Only</span>
            </div>

            {eligible.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#3D2B35] p-4 text-xs text-[#A99CAF]">
                No verified volunteers found within 15 km of this zone.
              </div>
            ) : (
              <div className="space-y-2.5">
                {eligible.map((vol) => {
                  const checked = selectedVolIds.includes(vol._id);
                  return (
                    <label
                      key={vol._id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3 text-xs cursor-pointer hover:border-[#BEA3E4]"
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedVolIds((p) => [...p, vol._id]);
                            } else {
                              setSelectedVolIds((p) =>
                                p.filter((id) => id !== vol._id)
                              );
                            }
                          }}
                          className="mt-0.5 h-4 w-4 accent-[#D946A8]"
                        />
                        <div>
                          <div className="font-semibold text-[#F8F2F7]">
                            {vol.displayName}
                          </div>
                          <div className="text-[11px] text-[#A99CAF]">
                            {vol.registeredArea}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="rounded-full bg-[#005236] px-2 py-0.5 text-[10px] font-medium text-[#6FFBBE]">
                              {vol.verificationStatus}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                vol.telegramLinked
                                  ? "bg-[#38203F] text-[#EDDCFF]"
                                  : "bg-[#2F2639] text-[#A99CAF]"
                              }`}
                            >
                              {vol.telegramLinked
                                ? "Telegram Linked"
                                : "Telegram Not Linked"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="font-mono text-xs font-semibold text-[#FFAEDA] tabular-nums">
                        {vol.approxDistanceText}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-3">
            <h3 className="font-heading text-base font-semibold">
              Dispatch &amp; Volunteer Responses ({notifications.length})
            </h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-[#A99CAF]">
                No alerts have been dispatched for this incident yet.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {notifications.map((n) => (
                  <div
                    key={`${n.incidentId}-${n.volunteerId}`}
                    className="rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{n.volunteerName}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                          n.acknowledgementStatus === "accepted"
                            ? "bg-[#005236] text-[#6FFBBE]"
                            : n.acknowledgementStatus === "declined"
                              ? "bg-[#93000A] text-[#FFDAD6]"
                              : "bg-[#653E00] text-[#FFDDB8]"
                        }`}
                      >
                        Response: {n.acknowledgementStatus}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[#A99CAF]">
                      <span>Telegram: {n.telegramStatus}</span>
                      <span className="tabular-nums">
                        {new Date(n.notificationSentAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {n.telegramError && (
                      <div className="mt-1 text-[11px] text-[#FFB95F]">
                        {n.telegramError}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#3D2B35] bg-[#211829] p-6 shadow-2xl space-y-4 text-[#F8F2F7]">
            <div className="flex items-center gap-2.5 text-[#FFAEDA]">
              <ShieldAlert className="h-6 w-6 text-[#D946A8]" />
              <h3 className="font-heading text-lg font-semibold">
                Confirm Volunteer Alert Dispatch
              </h3>
            </div>
            <p className="text-sm text-[#A99CAF]">
              You are about to dispatch{" "}
              <strong className="text-[#F8F2F7]">{selectedVolIds.length}</strong>{" "}
              verified community volunteer(s) near{" "}
              <strong className="text-[#F8F2F7]">
                {incident.incidentLocation.approxLabel}
              </strong>
              . Only the PrivacyShield non-identifying preview and approximate
              location will be shared — never raw footage.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDispatchModal(false)}
                className="rounded-lg border border-[#3D2B35] bg-[#160E1F] px-4 py-2 text-xs font-semibold text-[#A99CAF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDispatch}
                className="rounded-lg bg-[#D946A8] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c13592] cursor-pointer"
              >
                {busy ? "Dispatching…" : "Confirm & Send Alerts"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
