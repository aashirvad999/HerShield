"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  Camera,
  Cpu,
  ExternalLink,
  Gauge,
  MapPin,
  Play,
  ShieldCheck,
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
  modelLoaded?: boolean;
  modelError?: string | null;
  fps?: number;
  inferenceMs?: number;
  inferenceSize?: number;
  collapseTimer?: {
    active: boolean;
    trackId: number | null;
    elapsedSeconds: number;
    remainingSeconds: number;
    requiredSeconds: number;
  };
  privacyShieldActive?: boolean;
  bufferFrames?: number;
  lastError?: string | null;
}

interface UploadStatus {
  status: string;
  fileName: string | null;
  progressPct: number;
  framesProcessed: number;
  totalFrames: number;
  measuredFps: number;
  incidents: Array<{ incidentId: string; incidentType: string }>;
  error: string | null;
}

export function OperatorDashboardClient() {
  const [sourceType, setSourceType] = useState<string>("webcam");
  const [cameraIndex, setCameraIndex] = useState<number>(0);
  const [cameras, setCameras] = useState<
    Array<{ index: number; label: string; width: number; height: number; active: boolean }>
  >([]);
  const [deviceHints, setDeviceHints] = useState<string[]>([]);
  const [browserCameras, setBrowserCameras] = useState<string[]>([]);
  const [scanningCameras, setScanningCameras] = useState<boolean>(false);
  const [phoneUrl, setPhoneUrl] = useState<string>(
    "http://192.168.1.25:8080/video"
  );
  const [areaPresetId, setAreaPresetId] = useState<string>(
    DEMO_LOCATION_PRESETS[0].id
  );
  const [aggressionThreshold, setAggressionThreshold] = useState<number>(0.58);
  const [collapseSeconds, setCollapseSeconds] = useState<number>(5.0);

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
  const [analysisMode, setAnalysisMode] = useState<"person" | "car_crash">("person");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    measuredFps: number;
    avgInferenceMs: number;
    device: string;
    gpuName?: string | null;
  } | null>(null);
  const [streamKey, setStreamKey] = useState<number>(1);
  // Vercel serverless functions do not support infinite MJPEG streaming; default to sequential frame polling off-localhost
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
      // Keep dashboard responsive even if a poll misses
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    setScanningCameras(true);
    try {
      const res = await fetch("/api/ai-proxy/cameras", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
        setDeviceHints(data.deviceHints || []);
      }
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const labels = devs
          .filter((d) => d.kind === "videoinput" && d.label)
          .map((d) => d.label);
        setBrowserCameras(labels);
      }
    } finally {
      setScanningCameras(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshCameras();
    }, 100);
    return () => clearTimeout(t);
  }, [refreshCameras]);

  useEffect(() => {
    const initial = setTimeout(() => {
      void refreshData();
    }, 0);
    const timer = setInterval(() => {
      void refreshData();
    }, 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshData]);

  useEffect(() => {
    // Allow MJPEG automatically only on direct localhost; keep reliable sequential Frame Poll on Vercel/tunnels
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
        const res = await fetch("/api/ai-proxy/upload/status", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as UploadStatus;
          setUploadStatus(data);
          if (data.status === "completed") {
            refreshData();
          }
        }
      } catch { }
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
          aggressionThreshold,
          collapseConfirmSeconds: collapseSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setActionBanner(data.error || "Unable to start monitoring.");
      } else {
        setStreamKey((k) => k + 1);
      }
      await refreshData();
    } catch {
      setActionBanner("Local AI service offline. Start FastAPI backend.");
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
      fd.append("analysisMode", analysisMode);
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
          measuredFps: 0,
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

  async function handleRunBenchmark() {
    setBusyAction(true);
    setActionBanner(null);
    try {
      const res = await fetch("/api/ai-proxy/benchmark", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setActionBanner(data.error || "Benchmark failed.");
      } else {
        setBenchmarkResult(data);
      }
    } catch {
      setActionBanner("AI service offline — cannot run benchmark.");
    } finally {
      setBusyAction(false);
    }
  }

  const collapseActive = Boolean(aiHealth.collapseTimer?.active);

  return (
    <div className="flex flex-col gap-6">
      {/* Top KPI strip matching Stitch summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Active incidents</span>
            <AlertCircle className="h-[18px] w-[18px] text-[#FFB95F]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {stats.activeCount}
            </span>
            <span className="text-xs text-[#A99CAF]">Open / Dispatched</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Alerts dispatched</span>
            <Bell className="h-[18px] w-[18px] text-[#BEA3E4]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {stats.dispatchedCount}
            </span>
            <span className="text-xs text-[#BEA3E4]">Verified network</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#A99CAF]">
            <span>Volunteers notified</span>
            <Users className="h-[18px] w-[18px] text-[#4EDEA3]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {stats.volunteersNotified}
            </span>
            <span className="text-xs text-[#4EDEA3]">Geospatial match</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#241C2E] border border-[#3D2B35] p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-[#BEA3E4]">
            <span>PrivacyShield buffer</span>
            <ShieldCheck className="h-[18px] w-[18px] text-[#D946A8]" />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-heading text-lg font-semibold text-[#F8F2F7]">
              {aiHealth.online ? "Armed (RAM)" : "Standby"}
            </span>
            <span className="font-mono text-xs text-[#A99CAF] tabular-nums">
              {aiHealth.online ? `${aiHealth.bufferFrames ?? 0} frames` : "Local"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D2B35] pb-4">
              <div>
                <h2 className="font-heading text-lg font-semibold text-[#F8F2F7]">
                  Live Camera &amp; AI Inference Feed
                </h2>

              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3D2B35] bg-[#38203F] px-3 py-1 text-[#FFAEDA]">
                  <Bell className="h-3.5 w-3.5 text-[#D946A8]" />
                  Auto-Dispatch &gt;75% Risk
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3D2B35] bg-[#241C2E] px-3 py-1 font-mono text-[#EDDCFF] tabular-nums">
                  <Gauge className="h-3.5 w-3.5 text-[#D946A8]" />
                  {aiHealth.online
                    ? `${aiHealth.fps ?? 0} FPS (${aiHealth.inferenceMs ?? 0}ms)`
                    : "0.0 FPS"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3D2B35] bg-[#241C2E] px-3 py-1 text-[#BEA3E4]">
                  <Cpu className="h-3.5 w-3.5 text-[#4EDEA3]" />
                  {aiHealth.online
                    ? aiHealth.device === "cuda"
                      ? `CUDA: ${aiHealth.gpuName || "RTX GPU"}`
                      : "CPU Fallback"
                    : "AI Offline"}
                </span>
              </div>
            </div>

            {collapseActive && aiHealth.collapseTimer && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#653E00] bg-[#653E00]/40 px-4 py-3 text-[#FFDDB8]">
                <div className="flex items-center gap-2.5">
                  <Timer className="h-5 w-5 animate-pulse text-[#FFB95F]" />
                  <div>
                    <div className="text-sm font-semibold">
                      Suspected Collapse Confirmation Timer Running (Subject #
                      {aiHealth.collapseTimer.trackId})
                    </div>
                    <div className="text-xs text-[#FFDDB8]/80">
                      Timer resets automatically if person recovers upright
                      posture.
                    </div>
                  </div>
                </div>
                <div className="font-mono text-lg font-bold tabular-nums">
                  {aiHealth.collapseTimer.elapsedSeconds.toFixed(1)}s /{" "}
                  {aiHealth.collapseTimer.requiredSeconds.toFixed(0)}s
                </div>
              </div>
            )}

            <div className="relative mt-4 overflow-hidden rounded-xl border border-[#3D2B35] bg-[#120B1B] aspect-[4/3]">
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
                      setTimeout(() => {
                        setFrameTick((t) => t + 1);
                      }, 25);
                    }
                  }}
                  onError={() => {
                    if (!snapshotMode) {
                      setSnapshotMode(true);
                    } else {
                      setTimeout(() => {
                        setFrameTick((t) => t + 1);
                      }, 600);
                    }
                  }}
                  alt="HerShield Operator Live Stream"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <Video className="h-12 w-12 text-[#D946A8]/80" />
                  <h3 className="mt-3 font-heading text-lg font-semibold">
                    Local AI Inference Service Offline
                  </h3>
                  <p className="mt-1.5 max-w-md text-xs text-[#A99CAF]">
                    Start the Python FastAPI service on your laptop to enable
                    live webcam, phone IP stream, and YOLO11n-pose detection.
                  </p>
                </div>
              )}
            </div>

            {(actionBanner || aiHealth.lastError) && (
              <div className="mt-3 rounded-lg border border-[#93000A] bg-[#93000A]/40 px-3.5 py-2.5 text-xs text-[#FFDAD6]">
                {actionBanner || aiHealth.lastError}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="mb-1 block text-xs font-medium text-[#A99CAF]">
                  Camera / Scenario Source
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSourceType(val);
                    if (val === "webcam") {
                      void refreshCameras();
                    }
                  }}
                  className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                >
                  <option value="webcam">
                    Laptop Webcam
                  </option>
                  <option value="phone_ip">
                    Phone Camera / Network Stream (MJPEG/RTSP)
                  </option>
                  <option value="sample_aggression">
                    Sample Video: Potential Aggression Demo
                  </option>
                  <option value="sample_collapse">
                    Sample Video: 5s Collapse Confirmation Demo
                  </option>
                  <option value="sample_chain_snatching">
                    Sample Video: Chain-Snatching (Experimental)
                  </option>
                  <option value="sample_vehicle">
                    Sample Video: Vehicle/Pedestrian (Experimental)
                  </option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-medium text-[#A99CAF]">
                  Camera Zone / Location
                </label>
                <select
                  value={areaPresetId}
                  onChange={(e) => setAreaPresetId(e.target.value)}
                  className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                >
                  {DEMO_LOCATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.areaName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2 sm:col-span-3">
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleStartMonitoring}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#D946A8] px-3 py-2 text-xs font-semibold text-white hover:bg-[#c13592] disabled:opacity-50 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" />
                  Start
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={handleStopMonitoring}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-3 py-2 text-xs font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] disabled:opacity-50 cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
              </div>
            </div>

            {sourceType === "webcam" && (
              <div className="mt-3 rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-[#EDDCFF]">
                    <Camera className="h-3.5 w-3.5 text-[#D946A8]" />
                    Connected Camera Device
                  </label>
                  <button
                    type="button"
                    disabled={scanningCameras}
                    onClick={refreshCameras}
                    className="rounded-md border border-[#3D2B35] bg-[#38203F] px-2.5 py-1 text-[11px] font-medium text-[#EDDCFF] hover:border-[#BEA3E4] disabled:opacity-50 cursor-pointer"
                  >
                    {scanningCameras ? "Scanning…" : "Refresh Cameras"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={cameraIndex}
                    onChange={(e) => setCameraIndex(Number(e.target.value))}
                    className="flex-1 min-w-[220px] rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                  >
                    {cameras.length === 0 ? (
                      <>
                        <option value={0}>Camera #0 (Default Webcam)</option>
                        <option value={1}>Camera #1 (Secondary / USB / Virtual)</option>
                        <option value={2}>Camera #2</option>
                      </>
                    ) : (
                      cameras.map((cam) => {
                        const browserLabel = browserCameras[cam.index];
                        const hint =
                          browserLabel && !cam.label.includes(browserLabel)
                            ? browserLabel
                            : null;
                        return (
                          <option key={cam.index} value={cam.index}>
                            {cam.label}
                            {hint ? ` — ${hint}` : ""}
                          </option>
                        );
                      })
                    )}
                  </select>

                  <label className="flex items-center gap-1.5 text-[11px] text-[#A99CAF]">
                    <span>Manual Index:</span>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={cameraIndex}
                      onChange={(e) => setCameraIndex(Number(e.target.value))}
                      className="w-14 rounded-lg border border-[#3D2B35] bg-[#160E1F] px-2 py-1.5 font-mono text-xs text-[#F8F2F7]"
                    />
                  </label>
                </div>

                {(deviceHints.length > 0 || browserCameras.length > 0) && (
                  <p className="text-[11px] text-[#A99CAF]">
                    Detected on system:{" "}
                    <span className="text-[#BEA3E4]">
                      {(browserCameras.length > 0 ? browserCameras : deviceHints).join(" • ")}
                    </span>
                  </p>
                )}
              </div>
            )}

            {sourceType === "phone_ip" && (
              <div className="mt-3 rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#EDDCFF]">
                  <Smartphone className="h-3.5 w-3.5 text-[#D946A8]" />
                  Phone Camera Stream URL (MJPEG or RTSP)
                </label>
                <input
                  type="url"
                  value={phoneUrl}
                  onChange={(e) => setPhoneUrl(e.target.value)}
                  className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-1.5 font-mono text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
                />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#3D2B35] pt-3 text-xs text-[#A99CAF]">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <span>Aggression Threshold:</span>
                  <input
                    type="number"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={aggressionThreshold}
                    onChange={(e) =>
                      setAggressionThreshold(Number(e.target.value))
                    }
                    className="w-16 rounded-md border border-[#3D2B35] bg-[#160E1F] px-2 py-1 font-mono text-xs text-[#F8F2F7]"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>Collapse Timer (s):</span>
                  <input
                    type="number"
                    min="2"
                    max="15"
                    step="1"
                    value={collapseSeconds}
                    onChange={(e) =>
                      setCollapseSeconds(Number(e.target.value))
                    }
                    className="w-14 rounded-md border border-[#3D2B35] bg-[#160E1F] px-2 py-1 font-mono text-xs text-[#F8F2F7]"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSnapshotMode((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-3 py-1.5 text-xs font-medium text-[#A99CAF] hover:border-[#BEA3E4] hover:text-white cursor-pointer"
                >
                  {snapshotMode ? "Stream: Frame Poll" : "Stream: Live MJPEG"}
                </button>
                <button
                  type="button"
                  onClick={handleRunBenchmark}
                  disabled={busyAction}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-3 py-1.5 text-xs font-medium text-[#EDDCFF] hover:border-[#BEA3E4] cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5 text-[#D946A8]" />
                  Benchmark GPU/CPU FPS
                </button>
              </div>
            </div>

            {benchmarkResult && (
              <div className="mt-3 rounded-lg border border-[#005236] bg-[#005236]/50 px-3.5 py-2 text-xs text-[#6FFBBE]">
                Measured Benchmark ({benchmarkResult.device.toUpperCase()}
                {benchmarkResult.gpuName ? ` • ${benchmarkResult.gpuName}` : ""}
                ):{" "}
                <strong className="font-mono">
                  {benchmarkResult.measuredFps} FPS
                </strong>{" "}
                ({benchmarkResult.avgInferenceMs} ms/frame at 640px)
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Video Upload + Recent Incidents */}
        <div className="space-y-5 lg:col-span-4">
          <form
            onSubmit={handleUploadProcess}
            className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-[#F8F2F7]">
                Upload &amp; Process Sample Video
              </h2>
              <Upload className="h-4 w-4 text-[#BEA3E4]" />
            </div>
            <p className="text-xs text-[#A99CAF]">
              Runs local YOLO11n-pose + ByteTrack on uploaded clips and removes
              raw files after PrivacyShield extraction.
            </p>
            <select
              value={analysisMode}
              onChange={(e) => setAnalysisMode(e.target.value as "person" | "car_crash")}
              className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
            >
              <option value="person">Person Safety Detection</option>
              <option value="car_crash">Car Crash Detection</option>
            </select>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-[#A99CAF] file:mr-3 file:rounded-md file:border file:border-[#3D2B35] file:bg-[#38203F] file:px-3 py-1.5 file:text-xs file:font-medium file:text-[#EDDCFF]"
            />
            <button
              type="submit"
              disabled={!uploadFile || busyAction}
              className="w-full rounded-lg bg-[#D946A8] py-2.5 text-xs font-semibold text-white hover:bg-[#c13592] disabled:opacity-50 cursor-pointer"
            >
              Process Uploaded Video
            </button>

            {uploadStatus && uploadStatus.status !== "idle" && (
              <div className="rounded-lg bg-[#241C2E] p-3 text-xs space-y-1.5 border border-[#3D2B35]">
                <div className="flex justify-between font-medium">
                  <span className="truncate">{uploadStatus.fileName}</span>
                  <span className="uppercase text-[#FFAEDA]">
                    {uploadStatus.status}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#160E1F]">
                  <div
                    className="h-full bg-[#D946A8] transition-all"
                    style={{ width: `${uploadStatus.progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#A99CAF] font-mono tabular-nums">
                  <span>{uploadStatus.framesProcessed} frames</span>
                  <span>{uploadStatus.measuredFps} FPS</span>
                  <span>{uploadStatus.incidents.length} alert(s)</span>
                </div>
                {uploadStatus.error && (
                  <div className="text-[#FFB4AB]">{uploadStatus.error}</div>
                )}
              </div>
            )}
          </form>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-[#F8F2F7]">
                Recent Incidents
              </h2>
              <Link
                href="/operator/history"
                className="text-xs font-medium text-[#BEA3E4] hover:text-[#FFAEDA]"
              >
                View All
              </Link>
            </div>

            <div className="space-y-2.5 max-h-[470px] overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#3D2B35] p-5 text-center text-xs text-[#A99CAF]">
                  No incidents detected yet.
                </div>
              ) : (
                incidents.slice(0, 8).map((inc) => (
                  <Link
                    key={inc.incidentId}
                    href={`/operator/incidents/${inc.incidentId}`}
                    className="block rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3.5 hover:border-[#BEA3E4] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-heading text-sm font-medium text-[#F8F2F7]">
                        {inc.incidentTitle}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#A99CAF]" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <IncidentStatusBadge status={inc.incidentStatus} />
                      <ConfidenceBadge
                        score={inc.incidentConfidence}
                        type={inc.confidenceType}
                      />
                      {inc.autoDispatched && (
                        <span className="rounded-full bg-[#38203F] border border-[#D946A8]/40 px-2 py-0.5 text-[10px] font-semibold text-[#FFAEDA]">
                          Auto-Sent (&gt;75%)
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#A99CAF]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[#D946A8]" />
                        {inc.incidentLocation.areaName}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Date(inc.detectedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
