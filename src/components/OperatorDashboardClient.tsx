"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Camera,
  ExternalLink,
  Gauge,
  MapPin,
  Play,
  Smartphone,
  Square,
  Timer,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { ConfidenceBadge, IncidentStatusBadge } from "./StatusBadges";
import { DEMO_LOCATION_PRESETS, type IncidentDoc } from "@/lib/types";

interface AiHealth {
  online: boolean;
  running?: boolean;
  sourceType?: string;
  device?: string;
  gpuName?: string | null;
  fps?: number;
  inferenceMs?: number;
  detectionEnabled?: boolean;
  palmCooldownActive?: boolean;
  collapseTimer?: {
    active: boolean;
    trackId: number | null;
    elapsedSeconds: number;
    remainingSeconds: number;
    requiredSeconds: number;
  };
  lastError?: string | null;
}

interface UploadStatus {
  status: string;
  fileName: string | null;
  progressPct: number;
  framesProcessed: number;
  totalFrames: number;
  incidents: Array<{ incidentId: string; incidentType: string }>;
  error: string | null;
}

export function OperatorDashboardClient() {
  const [sourceType, setSourceType] = useState<string>("webcam");
  const [cameraIndex, setCameraIndex] = useState<number>(0);
  const [cameras, setCameras] = useState<
    Array<{ index: number; label: string; width: number; height: number; active: boolean }>
  >([]);
  const [scanningCameras, setScanningCameras] = useState<boolean>(false);
  const [phoneUrl, setPhoneUrl] = useState<string>("http://192.168.1.25:8080/video");
  const [areaPresetId, setAreaPresetId] = useState<string>(DEMO_LOCATION_PRESETS[0].id);

  const [aiHealth, setAiHealth] = useState<AiHealth>({ online: false });
  const [incidents, setIncidents] = useState<IncidentDoc[]>([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    dispatchedCount: 0,
    volunteersNotified: 0,
  });

  const [busyAction, setBusyAction] = useState<boolean>(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [streamKey, setStreamKey] = useState<number>(1);
  const [snapshotMode, setSnapshotMode] = useState<boolean>(true);
  const [frameTick, setFrameTick] = useState<number>(0);

  const refreshData = useCallback(async () => {
    try {
      const [incRes, aiRes] = await Promise.all([
        fetch("/api/incidents", { cache: "no-store" }),
        fetch("/api/ai-proxy/health", { cache: "no-store" }).catch(() => null),
      ]);

      if (incRes.ok) {
        const incData = await incRes.json();
        setIncidents(incData.incidents || []);
        if (incData.stats) {
          setStats({
            activeCount: incData.stats.activeCount ?? 0,
            dispatchedCount: incData.stats.dispatchedCount ?? 0,
            volunteersNotified: incData.stats.volunteersNotified ?? 0,
          });
        }
      }

      if (aiRes && aiRes.ok) {
        const healthData = await aiRes.json();
        setAiHealth(healthData);
      } else {
        setAiHealth({ online: false });
      }
    } catch {
      // Keep UI responsive
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    setScanningCameras(true);
    try {
      const res = await fetch("/api/ai-proxy/cameras", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } finally {
      setScanningCameras(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshCameras(), 100);
    return () => clearTimeout(t);
  }, [refreshCameras]);

  useEffect(() => {
    const initial = setTimeout(() => void refreshData(), 0);
    const timer = setInterval(() => void refreshData(), 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshData]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1")
    ) {
      const t = setTimeout(() => setSnapshotMode(false), 0);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!uploadStatus || uploadStatus.status !== "processing") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/ai-proxy/upload/status", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as UploadStatus;
          setUploadStatus(data);
          if (data.status === "completed") refreshData();
        }
      } catch {}
    }, 1000);
    return () => clearInterval(timer);
  }, [uploadStatus, refreshData]);

  async function handleStartMonitoring() {
    setBusyAction(true);
    setActionBanner(null);
    try {
      const res = await fetch("/api/ai-proxy/monitoring/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType,
          cameraIndex,
          sourceUrl: sourceType === "phone_ip" ? phoneUrl : undefined,
          areaPresetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionBanner(data.error || "Unable to start monitoring.");
      } else {
        setStreamKey((k) => k + 1);
      }
      await refreshData();
    } catch {
      setActionBanner("AI service offline. Start HerShield AI service first.");
    } finally {
      setBusyAction(false);
    }
  }

  async function handleStopMonitoring() {
    setBusyAction(true);
    try {
      await fetch("/api/ai-proxy/monitoring/stop", { method: "POST" });
      await refreshData();
    } finally {
      setBusyAction(false);
    }
  }

  async function handleUploadProcess(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setBusyAction(true);
    setActionBanner(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("areaPresetId", areaPresetId);
      const res = await fetch("/api/ai-proxy/video/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setActionBanner(data.error || "Video upload failed.");
      } else {
        setUploadStatus({
          status: "processing",
          fileName: uploadFile.name,
          progressPct: 5,
          framesProcessed: 0,
          totalFrames: 0,
          incidents: [],
          error: null,
        });
      }
    } catch {
      setActionBanner("Unable to reach AI service for video processing.");
    } finally {
      setBusyAction(false);
    }
  }

  const collapseActive = Boolean(aiHealth.collapseTimer?.active);

  return (
    <div className="flex flex-col gap-5">
      {/* Compact 3-Stat Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white border border-[#F3D5E5] p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-medium text-[#7A566E]">Active Incidents</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-[#2B1324] tabular-nums">
              {stats.activeCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#F3D5E5] p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-medium text-[#7A566E]">Alerts Dispatched</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-[#DB2777] tabular-nums">
              {stats.dispatchedCount}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#FCE7F3] text-[#DB2777] flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#F3D5E5] p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-medium text-[#7A566E]">Volunteers Notified</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-[#2B1324] tabular-nums">
              {stats.volunteersNotified}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#FDF2F8] text-[#DB2777] flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Live Camera & Controls */}
        <div className="space-y-4 lg:col-span-8">
          <div className="rounded-2xl border border-[#F3D5E5] bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3D5E5] pb-3.5">
              <h2 className="font-heading text-base font-semibold text-[#2B1324]">
                Live Camera Feed
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {aiHealth.online && aiHealth.palmCooldownActive && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 font-medium text-amber-700">
                    {aiHealth.detectionEnabled === false ? "Paused (Palm Toggle)" : "Resuming..."}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF2F8] border border-[#F3D5E5] px-3 py-1 font-mono text-[#DB2777] tabular-nums">
                  <Gauge className="h-3.5 w-3.5" />
                  {aiHealth.online ? `${aiHealth.fps ?? 0} FPS` : "0 FPS"}
                </span>
              </div>
            </div>

            {collapseActive && aiHealth.collapseTimer && (
              <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 animate-pulse text-amber-600" />
                  <span className="text-xs font-semibold">
                    Collapse Timer Active (Person #{aiHealth.collapseTimer.trackId})
                  </span>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {aiHealth.collapseTimer.elapsedSeconds.toFixed(1)}s /{" "}
                  {aiHealth.collapseTimer.requiredSeconds.toFixed(0)}s
                </span>
              </div>
            )}

            <div className="relative mt-4 overflow-hidden rounded-xl border border-[#F3D5E5] bg-[#1F101B] aspect-[4/3]">
              {aiHealth.online ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={snapshotMode ? "snapshot" : `mjpeg-${streamKey}`}
                  src={
                    snapshotMode
                      ? `/api/ai-proxy/frame.jpg?t=${frameTick}`
                      : `/api/ai-proxy/stream?v=${streamKey}`
                  }
                  onLoad={() => {
                    if (snapshotMode) {
                      setTimeout(() => setFrameTick((t) => t + 1), 25);
                    }
                  }}
                  onError={() => {
                    if (!snapshotMode) {
                      setSnapshotMode(true);
                    } else {
                      setTimeout(() => setFrameTick((t) => t + 1), 600);
                    }
                  }}
                  alt="HerShield Live Feed"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center text-white">
                  <Video className="h-10 w-10 text-[#F472B6] mb-2" />
                  <p className="text-sm font-semibold">AI Service Offline</p>
                  <p className="mt-1 text-xs text-pink-200">
                    Run start-hershield.bat to start the local AI service.
                  </p>
                </div>
              )}
            </div>

            {aiHealth.lastError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {aiHealth.lastError}
              </div>
            )}

            {actionBanner && (
              <div className="mt-3 rounded-xl border border-[#FBCFE8] bg-[#FDF2F8] px-3 py-2 text-xs text-[#DB2777]">
                {actionBanner}
              </div>
            )}

            {/* Clean Controls */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#7A566E]">
                  Video Source
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-sm text-[#2B1324] focus:border-[#DB2777] focus:outline-none"
                >
                  <option value="webcam">Laptop / USB Webcam</option>
                  <option value="phone_ip">Phone IP Stream</option>
                  <option value="sample_aggression">Sample: Aggression</option>
                  <option value="sample_collapse">Sample: Collapse</option>
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[#7A566E]">
                  <MapPin className="h-3.5 w-3.5 text-[#DB2777]" />
                  Camera Location
                </label>
                <select
                  value={areaPresetId}
                  onChange={(e) => setAreaPresetId(e.target.value)}
                  className="w-full rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-sm text-[#2B1324] focus:border-[#DB2777] focus:outline-none"
                >
                  {DEMO_LOCATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.areaName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sourceType === "webcam" && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[#7A566E]">
                    <Camera className="h-3.5 w-3.5 text-[#DB2777]" />
                    Camera Device
                  </label>
                  <select
                    value={cameraIndex}
                    onChange={(e) => setCameraIndex(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-sm text-[#2B1324] focus:border-[#DB2777] focus:outline-none"
                  >
                    {cameras.length > 0 ? (
                      cameras.map((cam) => (
                        <option key={cam.index} value={cam.index}>
                          {cam.label}
                        </option>
                      ))
                    ) : (
                      <option value={0}>Default Webcam (#0)</option>
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={refreshCameras}
                  disabled={scanningCameras}
                  className="rounded-xl border border-[#F3D5E5] bg-[#FDF2F8] px-3 py-2 text-xs font-medium text-[#DB2777] hover:bg-[#FCE7F3] cursor-pointer"
                >
                  {scanningCameras ? "Scanning..." : "Scan"}
                </button>
              </div>
            )}

            {sourceType === "phone_ip" && (
              <div className="mt-3">
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[#7A566E]">
                  <Smartphone className="h-3.5 w-3.5 text-[#DB2777]" />
                  Stream URL (MJPEG / RTSP)
                </label>
                <input
                  type="text"
                  value={phoneUrl}
                  onChange={(e) => setPhoneUrl(e.target.value)}
                  className="w-full rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-sm text-[#2B1324] focus:border-[#DB2777] focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleStartMonitoring}
                disabled={busyAction || !aiHealth.online}
                className="inline-flex items-center gap-2 rounded-xl bg-[#DB2777] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#BE185D] disabled:opacity-50 cursor-pointer transition"
              >
                <Play className="h-4 w-4" />
                {aiHealth.running ? "Restart" : "Start Camera"}
              </button>

              <button
                type="button"
                onClick={handleStopMonitoring}
                disabled={busyAction || !aiHealth.running}
                className="inline-flex items-center gap-2 rounded-xl border border-[#F3D5E5] bg-white px-4 py-2.5 text-sm font-semibold text-[#2B1324] hover:border-[#DB2777] hover:text-[#DB2777] disabled:opacity-40 cursor-pointer transition"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>

              <button
                type="button"
                onClick={() => setSnapshotMode((m) => !m)}
                className="ml-auto rounded-xl border border-[#F3D5E5] bg-[#FDF2F8] px-3 py-2 text-xs font-medium text-[#7A566E] hover:text-[#DB2777] cursor-pointer"
              >
                {snapshotMode ? "Mode: Frame Poll" : "Mode: Live MJPEG"}
              </button>
            </div>
          </div>

          {/* Compact Video Upload */}
          <form
            onSubmit={handleUploadProcess}
            className="rounded-2xl border border-[#F3D5E5] bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2B1324]">
              <Upload className="h-4 w-4 text-[#DB2777]" />
              <span>Analyze Video File</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="text-xs text-[#7A566E] file:mr-2 file:rounded-lg file:border-0 file:bg-[#FCE7F3] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#DB2777] hover:file:bg-[#FBCFE8]"
              />
              <button
                type="submit"
                disabled={!uploadFile || busyAction || !aiHealth.online}
                className="rounded-xl bg-[#DB2777] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D] disabled:opacity-40 cursor-pointer"
              >
                Process
              </button>
            </div>
            {uploadStatus && (
              <div className="w-full text-xs text-[#7A566E]">
                {uploadStatus.status === "processing"
                  ? `Processing ${uploadStatus.fileName}: ${uploadStatus.progressPct}%`
                  : uploadStatus.status === "completed"
                    ? `Done (${uploadStatus.incidents.length} incident(s) detected)`
                    : uploadStatus.error}
              </div>
            )}
          </form>
        </div>

        {/* Right: Recent Incidents */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-[#F3D5E5] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#F3D5E5] pb-3.5">
              <h2 className="font-heading text-base font-semibold text-[#2B1324]">
                Recent Incidents
              </h2>
              <Link
                href="/operator/history"
                className="text-xs font-semibold text-[#DB2777] hover:underline"
              >
                View All
              </Link>
            </div>

            <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#F3D5E5] bg-[#FFF7FA] p-6 text-center text-xs text-[#7A566E]">
                  No incidents detected yet.
                </div>
              ) : (
                incidents.slice(0, 10).map((inc) => (
                  <div
                    key={inc.incidentId}
                    className="rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#2B1324]">
                          {inc.incidentTitle}
                        </p>
                        <p className="text-[11px] text-[#7A566E]">
                          {inc.incidentLocation.approxLabel}
                        </p>
                      </div>
                      <IncidentStatusBadge status={inc.incidentStatus} />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <ConfidenceBadge
                        score={inc.incidentConfidence}
                        type={inc.confidenceType}
                      />
                      <Link
                        href={`/operator/incidents/${inc.incidentId}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#FCE7F3] px-2.5 py-1 text-[11px] font-semibold text-[#DB2777] hover:bg-[#FBCFE8]"
                      >
                        Review
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
