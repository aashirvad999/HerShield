import asyncio
import json
import os
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import httpx
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from config import (
    AGGRESSION_CONFIDENCE_THRESHOLD,
    AI_HOST,
    AI_PORT,
    AI_SERVICE_SECRET,
    ALLOWED_ORIGINS,
    APP_BACKEND_URL,
    COLLAPSE_CONFIRM_SECONDS,
    INFERENCE_FPS_TARGET,
    INFERENCE_SIZE,
    PREVIEWS_DIR,
    SAMPLES_DIR,
    UPLOADS_DIR,
)
from detector import HerShieldDetector
from privacy_shield import PrivacyShieldBuffer, SanitizedFrameSnapshot

app = FastAPI(title="HerShield Local AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_secret(x_hershield_ai_secret: Optional[str] = Header(default=None)) -> None:
    if AI_SERVICE_SECRET and x_hershield_ai_secret != AI_SERVICE_SECRET:
        # Allow local dev when secret header matches or default dev secret
        if x_hershield_ai_secret != "hershield-local-ai-secret":
            raise HTTPException(status_code=401, detail="Invalid AI service secret")


class StartMonitoringRequest(BaseModel):
    sourceType: str = "webcam"  # webcam | phone_ip | sample_aggression | sample_collapse | sample_chain_snatching | sample_vehicle
    cameraIndex: int = 0
    sourceUrl: Optional[str] = None
    areaPresetId: str = "indiranagar-100ft"
    aggressionThreshold: float = AGGRESSION_CONFIDENCE_THRESHOLD
    collapseConfirmSeconds: float = COLLAPSE_CONFIRM_SECONDS


class MonitoringState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.running = False
        self.source_type = "idle"
        self.camera_index: Optional[int] = None
        self.area_preset_id = "indiranagar-100ft"
        self.aggression_threshold = AGGRESSION_CONFIDENCE_THRESHOLD
        self.collapse_confirm_seconds = COLLAPSE_CONFIRM_SECONDS
        self.fps = 0.0
        self.inference_ms = 0.0
        self.last_error: Optional[str] = None
        self.latest_jpeg: Optional[bytes] = None
        self.recent_events: List[Dict[str, Any]] = []
        self.stop_event = threading.Event()
        self.worker_thread: Optional[threading.Thread] = None
        self.upload_status: Dict[str, Any] = {
            "status": "idle",
            "fileName": None,
            "progressPct": 0,
            "framesProcessed": 0,
            "totalFrames": 0,
            "measuredFps": 0.0,
            "incidents": [],
            "error": None,
        }


state = MonitoringState()
detector = HerShieldDetector()
privacy_buffer = PrivacyShieldBuffer(max_seconds=12.0, approx_fps=INFERENCE_FPS_TARGET)


def render_idle_jpeg(title: str = "Monitoring Idle", subtitle: str = "Select Laptop Webcam, Phone Camera, Sample Scenario, or Upload Video") -> bytes:
    canvas = np.full((480, 640, 3), (31, 14, 22), dtype=np.uint8)
    cv2.rectangle(canvas, (20, 20), (620, 460), (63, 32, 56), 2)
    cv2.putText(canvas, "HERSHIELD LOCAL AI ENGINE", (42, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (228, 163, 190), 2, cv2.LINE_AA)
    cv2.putText(canvas, title, (42, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (248, 245, 250), 2, cv2.LINE_AA)
    cv2.putText(canvas, subtitle[:62], (42, 265), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (175, 154, 169), 1, cv2.LINE_AA)
    cv2.putText(canvas, "PrivacyShield: In-memory rolling buffer armed", (42, 425), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (168, 70, 217), 1, cv2.LINE_AA)
    ok, buf = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes() if ok else b""


state.latest_jpeg = render_idle_jpeg()


def push_incident_to_app(
    event: Dict[str, Any],
    camera_source: str,
    area_preset_id: str,
    snapshots: Optional[List[SanitizedFrameSnapshot]] = None,
    is_simulated_demo: bool = False,
) -> Dict[str, Any]:
    incident_id = f"HS-{int(time.time()) % 1000000}-{uuid.uuid4().hex[:3].upper()}"
    preview_meta = privacy_buffer.render_sanitized_preview(
        incident_id=incident_id,
        incident_title=event["incidentType"].replace("_", " ").title(),
        snapshots=snapshots,
        fps=max(6.0, min(12.0, state.fps or 10.0)),
    )

    payload = {
        "incidentId": incident_id,
        "incidentType": event["incidentType"],
        "incidentConfidence": event["incidentConfidence"],
        "confidenceType": event.get("confidenceType", "heuristic"),
        "detectionExplanation": event["detectionExplanation"],
        "cameraSource": camera_source,
        "areaPresetId": area_preset_id,
        "confirmationStatus": event.get("confirmationStatus", "pending_timer"),
        "sanitizedPreviewReference": preview_meta["preview_reference"],
        "sanitizedTimelineFrames": preview_meta["timeline_frames"],
        "previewSha256": preview_meta["preview_sha256"],
        "isSimulatedDemo": is_simulated_demo,
    }

    try:
        with httpx.Client(timeout=4.0) as client:
            res = client.post(
                f"{APP_BACKEND_URL}/api/incidents",
                json=payload,
                headers={"x-hershield-ai-secret": AI_SERVICE_SECRET},
            )
            if res.status_code >= 400:
                payload["syncWarning"] = f"Backend HTTP {res.status_code}"
    except Exception as exc:
        payload["syncWarning"] = f"Backend offline ({exc}); kept locally"

    with state.lock:
        state.recent_events.insert(0, payload)
        state.recent_events = state.recent_events[:20]

    return payload


def push_incident_in_background(
    event: Dict[str, Any],
    camera_source: str,
    area_preset_id: str,
    snapshots: Optional[List[SanitizedFrameSnapshot]] = None,
    is_simulated_demo: bool = False,
) -> None:
    snaps_copy = list(snapshots) if snapshots is not None else list(privacy_buffer.buffer)
    threading.Thread(
        target=push_incident_to_app,
        args=(event, camera_source, area_preset_id, snaps_copy, is_simulated_demo),
        daemon=True,
    ).start()


class FreshFrameReader:
    """Spawns a dedicated camera ingestion thread to discard stale driver buffers and deliver real-time frames."""
    def __init__(self, cap: cv2.VideoCapture) -> None:
        self.cap = cap
        self.frame: Optional[np.ndarray] = None
        self.ret = False
        self.running = True
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _worker(self) -> None:
        while self.running and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret or frame is None:
                with self.lock:
                    self.ret = False
                break
            with self.lock:
                self.ret = True
                self.frame = frame

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        with self.lock:
            if self.frame is None:
                return self.ret, None
            return self.ret, self.frame.copy()

    def stop(self) -> None:
        self.running = False


def draw_hud(frame: np.ndarray, fps: float, inf_ms: float, source_label: str) -> np.ndarray:
    h, w = frame.shape[:2]
    cv2.rectangle(frame, (0, 0), (w, 34), (22, 14, 31), -1)
    device_txt = f"GPU: {detector.gpu_name}" if detector.device != "cpu" and detector.gpu_name else "CPU Mode"
    hud = f"HerShield AI | {source_label} | {fps:.1f} FPS | {inf_ms:.0f}ms | {device_txt}"
    cv2.putText(frame, hud[:85], (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (248, 245, 250), 1, cv2.LINE_AA)
    return frame


def run_synthetic_scenario(scenario: str, area_preset_id: str) -> None:
    """
    Simulated demonstration generator used ONLY when a prerecorded sample clip
    file is not present in ai-service/samples/, allowing reliable demo of:
    - Potential physical aggression
    - Suspected collapse + 5-second ground confirmation countdown
    - Chain snatching / Vehicle-pedestrian experimental scenarios
    """
    sample_map = {
        "sample_aggression": SAMPLES_DIR / "aggression.mp4",
        "sample_collapse": SAMPLES_DIR / "collapse.mp4",
        "sample_chain_snatching": SAMPLES_DIR / "chain_snatching.mp4",
        "sample_vehicle": SAMPLES_DIR / "vehicle_pedestrian.mp4",
    }
    clip_path = sample_map.get(scenario)
    if clip_path and clip_path.exists():
        run_capture_loop(str(clip_path), scenario, area_preset_id, loop_file=True)
        return

    t_start = time.time()
    emitted = False
    collapse_timer_start: Optional[float] = None
    target_interval = 1.0 / max(5.0, INFERENCE_FPS_TARGET)

    while not state.stop_event.is_set():
        loop_t0 = time.time()
        elapsed = loop_t0 - t_start
        canvas = np.full((480, 640, 3), (38, 22, 46), dtype=np.uint8)
        cv2.putText(
            canvas,
            f"SIMULATED DEMO SCENARIO: {scenario.replace('sample_', '').upper()}",
            (18, 62),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (228, 163, 190),
            1,
            cv2.LINE_AA,
        )

        boxes: List[Dict[str, Any]] = []
        kps_list: List[List[List[float]]] = []
        label = "Simulated monitoring"

        if scenario == "sample_aggression":
            # Two subjects converging rapidly with raised-arm oscillation
            shift = min(115, int(elapsed * 28))
            arm_wave = int(18 * np.sin(elapsed * 9.0))
            p1_cx = 175 + shift
            p2_cx = 465 - shift
            boxes = [
                {"x1": p1_cx - 35, "y1": 130, "x2": p1_cx + 35, "y2": 360, "trackId": 101},
                {"x1": p2_cx - 35, "y1": 135, "x2": p2_cx + 35, "y2": 365, "trackId": 102},
            ]
            kps1 = [
                [p1_cx, 150, 0.95], [p1_cx - 5, 145, 0.9], [p1_cx + 5, 145, 0.9],
                [p1_cx - 9, 148, 0.85], [p1_cx + 9, 148, 0.85],
                [p1_cx - 20, 185, 0.95], [p1_cx + 20, 185, 0.95],
                [p1_cx - 28, 220, 0.9], [p1_cx + 42, 175 + arm_wave, 0.95],
                [p1_cx - 25, 250, 0.85], [p1_cx + 68, 155 + arm_wave, 0.95],
                [p1_cx - 14, 265, 0.95], [p1_cx + 14, 265, 0.95],
                [p1_cx - 16, 312, 0.9], [p1_cx + 16, 312, 0.9],
                [p1_cx - 18, 355, 0.9], [p1_cx + 18, 355, 0.9],
            ]
            kps2 = [
                [p2_cx, 155, 0.95], [p2_cx - 5, 150, 0.9], [p2_cx + 5, 150, 0.9],
                [p2_cx - 9, 153, 0.85], [p2_cx + 9, 153, 0.85],
                [p2_cx - 20, 190, 0.95], [p2_cx + 20, 190, 0.95],
                [p2_cx - 42, 180 - arm_wave, 0.95], [p2_cx + 25, 225, 0.9],
                [p2_cx - 62, 160 - arm_wave, 0.95], [p2_cx + 24, 255, 0.85],
                [p2_cx - 14, 270, 0.95], [p2_cx + 14, 270, 0.95],
                [p2_cx - 16, 315, 0.9], [p2_cx + 16, 315, 0.9],
                [p2_cx - 18, 358, 0.9], [p2_cx + 18, 358, 0.9],
            ]
            kps_list = [kps1, kps2]
            if shift > 95:
                label = "Close proximity + rapid arm velocity"
                if not emitted and elapsed > 4.2:
                    emitted = True
                    push_incident_in_background(
                        {
                            "incidentType": "potential_aggression",
                            "incidentConfidence": 76,
                            "confidenceType": "heuristic",
                            "confirmationStatus": "pending_timer",
                            "detectionExplanation": "Simulated Demo Clip: Tracked subjects #101 & #102 converged within 0.65 body-heights with repeated rapid upper-limb velocity spikes.",
                        },
                        camera_source=scenario,
                        area_preset_id=area_preset_id,
                        is_simulated_demo=True,
                    )

        elif scenario == "sample_collapse":
            # Subject stands for 2s, then collapses and triggers live 5-second countdown
            if elapsed < 2.2:
                label = "Person upright (baseline)"
                boxes = [{"x1": 285, "y1": 120, "x2": 355, "y2": 370, "trackId": 201}]
                kps_list = [[
                    [320, 140, 0.95], [315, 135, 0.9], [325, 135, 0.9],
                    [310, 138, 0.85], [330, 138, 0.85],
                    [300, 178, 0.95], [340, 178, 0.95],
                    [292, 222, 0.9], [348, 222, 0.9],
                    [290, 260, 0.85], [350, 260, 0.85],
                    [306, 265, 0.95], [334, 265, 0.95],
                    [304, 315, 0.9], [336, 315, 0.9],
                    [302, 362, 0.9], [338, 362, 0.9],
                ]]
            else:
                if collapse_timer_start is None:
                    collapse_timer_start = loop_t0
                fall_dur = loop_t0 - collapse_timer_start
                req = state.collapse_confirm_seconds
                rem = max(0.0, req - fall_dur)
                detector.active_collapse_timer = {
                    "active": True,
                    "trackId": 201,
                    "elapsedSeconds": round(fall_dur, 1),
                    "remainingSeconds": round(rem, 1),
                    "requiredSeconds": req,
                }
                label = f"Ground posture check ({fall_dur:.1f}s / {req:.0f}s)"
                boxes = [{"x1": 195, "y1": 315, "x2": 445, "y2": 388, "trackId": 201}]
                kps_list = [[
                    [215, 348, 0.95], [212, 342, 0.9], [218, 342, 0.9],
                    [210, 345, 0.85], [220, 345, 0.85],
                    [255, 336, 0.95], [255, 366, 0.95],
                    [285, 332, 0.9], [285, 372, 0.9],
                    [305, 338, 0.85], [305, 375, 0.85],
                    [332, 340, 0.95], [332, 364, 0.95],
                    [382, 342, 0.9], [382, 366, 0.9],
                    [430, 344, 0.9], [430, 368, 0.9],
                ]]
                cv2.putText(
                    canvas,
                    f"5s COLLAPSE CONFIRMATION: {fall_dur:.1f}s / {req:.0f}s",
                    (120, 290),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.68,
                    (0, 195, 255),
                    2,
                )
                if not emitted and fall_dur >= req:
                    emitted = True
                    push_incident_in_background(
                        {
                            "incidentType": "suspected_collapse",
                            "incidentConfidence": 82,
                            "confidenceType": "heuristic",
                            "confirmationStatus": "auto_confirmed",
                            "detectionExplanation": f"Simulated Demo Clip: Subject #201 transitioned from upright to horizontal ground posture and remained down for {req:.0f}s confirmation window.",
                        },
                        camera_source=scenario,
                        area_preset_id=area_preset_id,
                        is_simulated_demo=True,
                    )

        else:
            # Chain snatching / Vehicle-pedestrian experimental scenario
            inc_type = "chain_snatching_demo" if scenario == "sample_chain_snatching" else "vehicle_pedestrian_demo"
            sx = int(120 + (elapsed * 70) % 360)
            boxes = [
                {"x1": 290, "y1": 150, "x2": 360, "y2": 360, "trackId": 301},
                {"x1": sx, "y1": 180, "x2": sx + 85, "y2": 350, "trackId": 302},
            ]
            label = f"Experimental scenario ({inc_type})"
            if not emitted and elapsed > 4.0:
                emitted = True
                push_incident_in_background(
                    {
                        "incidentType": inc_type,
                        "incidentConfidence": 61,
                        "confidenceType": "heuristic",
                        "confirmationStatus": "pending_timer",
                        "detectionExplanation": f"Experimental prerecorded scenario demonstration ({scenario}). Prototype secondary capability.",
                    },
                    camera_source=scenario,
                    area_preset_id=area_preset_id,
                    is_simulated_demo=True,
                )

        # Render synthetic operator preview boxes
        for b in boxes:
            cv2.rectangle(canvas, (int(b["x1"]), int(b["y1"])), (int(b["x2"]), int(b["y2"])), (168, 70, 217), 2)
            cv2.putText(canvas, f"Subject #{b['trackId']}", (int(b["x1"]), int(b["y1"]) - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (248, 245, 250), 1)

        snap = SanitizedFrameSnapshot(timestamp=loop_t0, width=640, height=480, boxes=boxes, keypoints_list=kps_list, label=label)
        privacy_buffer.push(snap)

        elapsed_loop = time.time() - loop_t0
        fps_now = 1.0 / max(target_interval, elapsed_loop)
        canvas = draw_hud(canvas, fps_now, elapsed_loop * 1000.0, scenario)
        ok, buf = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            with state.lock:
                state.fps = round(fps_now, 1)
                state.inference_ms = round(elapsed_loop * 1000.0, 1)
                state.latest_jpeg = buf.tobytes()

        sleep_for = target_interval - (time.time() - loop_t0)
        if sleep_for > 0:
            time.sleep(sleep_for)


def run_capture_loop(source: Any, source_label: str, area_preset_id: str, loop_file: bool = False) -> None:
    # Prefer default/MSMF backend on Windows (virtual cameras like Camo return black frames under CAP_DSHOW)
    cap = cv2.VideoCapture(source)
    if not cap.isOpened() and isinstance(source, int) and os.name == "nt":
        cap.release()
        cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)

    if not cap.isOpened():
        with state.lock:
            state.running = False
            state.last_error = f"Unable to open video source '{source_label}'. Check webcam permissions, camera URL, or use a sample/uploaded video."
            state.latest_jpeg = render_idle_jpeg("Camera / Stream Unavailable", state.last_error)
        return

    # Minimize driver buffer to 1 frame to eliminate latency
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass

    target_interval = 1.0 / max(4.0, INFERENCE_FPS_TARGET)
    consecutive_failures = 0
    is_live_stream = isinstance(source, (int, str)) and not loop_file and not Path(str(source)).is_file()
    reader = FreshFrameReader(cap) if is_live_stream else None

    try:
        while not state.stop_event.is_set():
            t0 = time.time()
            if reader is not None:
                ret, frame = reader.read()
            else:
                ret, frame = cap.read()

            if not ret or frame is None:
                if loop_file:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                consecutive_failures += 1
                if consecutive_failures >= 15:
                    with state.lock:
                        state.last_error = f"Video stream '{source_label}' disconnected."
                        state.running = False
                        state.latest_jpeg = render_idle_jpeg("Stream Disconnected", state.last_error)
                    break
                time.sleep(0.05)
                continue

            if frame.shape[1] > 960:
                new_h = int(frame.shape[0] * (960.0 / frame.shape[1]))
                frame = cv2.resize(frame, (960, new_h), interpolation=cv2.INTER_AREA)

            consecutive_failures = 0
            inf_t0 = time.time()
            annotated, snap, events = detector.process_frame(
                frame,
                aggression_threshold=state.aggression_threshold,
                collapse_confirm_seconds=state.collapse_confirm_seconds,
            )
            inf_ms = (time.time() - inf_t0) * 1000.0
            privacy_buffer.push(snap)

            for ev in events:
                push_incident_in_background(
                    ev,
                    camera_source=source_label,
                    area_preset_id=area_preset_id,
                    is_simulated_demo=False,
                )

            total_dt = max(0.001, time.time() - t0)
            fps_now = min(60.0, 1.0 / total_dt)
            annotated = draw_hud(annotated, fps_now, inf_ms, source_label)
            ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 78])
            if ok:
                with state.lock:
                    state.fps = round(fps_now, 1)
                    state.inference_ms = round(inf_ms, 1)
                    state.latest_jpeg = buf.tobytes()

            sleep_for = target_interval - (time.time() - t0)
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        if reader is not None:
            reader.stop()
        cap.release()
        with state.lock:
            state.running = False


@app.get("/health")
def health() -> Dict[str, Any]:
    with state.lock:
        return {
            "online": True,
            "running": state.running,
            "sourceType": state.source_type,
            "device": "cuda" if detector.device != "cpu" else "cpu",
            "gpuName": detector.gpu_name,
            "modelLoaded": detector.model is not None,
            "modelError": detector.model_error,
            "fps": state.fps,
            "inferenceMs": state.inference_ms,
            "inferenceSize": INFERENCE_SIZE,
            "collapseTimer": detector.active_collapse_timer,
            "privacyShieldActive": True,
            "bufferFrames": len(privacy_buffer.buffer),
            "lastError": state.last_error,
            "recentEvents": state.recent_events[:8],
        }


@app.post("/monitoring/start")
def start_monitoring(req: StartMonitoringRequest, x_hershield_ai_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    verify_secret(x_hershield_ai_secret)
    stop_monitoring_internal()

    detector.reset_state()
    privacy_buffer.clear()

    with state.lock:
        state.stop_event.clear()
        state.running = True
        state.source_type = req.sourceType
        state.camera_index = req.cameraIndex if req.sourceType == "webcam" else None
        state.area_preset_id = req.areaPresetId
        state.aggression_threshold = req.aggressionThreshold
        state.collapse_confirm_seconds = req.collapseConfirmSeconds
        state.last_error = None
        state.fps = 0.0
        state.inference_ms = 0.0
        state.latest_jpeg = render_idle_jpeg(
            "Initializing AI Stream...",
            f"Opening {req.sourceType} with YOLO11n-Pose",
        )

    if req.sourceType == "webcam":
        t = threading.Thread(
            target=run_capture_loop,
            args=(req.cameraIndex, f"laptop_webcam_{req.cameraIndex}", req.areaPresetId, False),
            daemon=True,
        )
    elif req.sourceType == "phone_ip":
        if not req.sourceUrl:
            with state.lock:
                state.running = False
                state.last_error = "Phone IP camera URL is required (e.g., http://192.168.1.25:8080/video or rtsp://...)."
            return {"ok": False, "error": state.last_error}
        t = threading.Thread(
            target=run_capture_loop,
            args=(req.sourceUrl, "phone_ip_camera", req.areaPresetId, False),
            daemon=True,
        )
    else:
        t = threading.Thread(
            target=run_synthetic_scenario,
            args=(req.sourceType, req.areaPresetId),
            daemon=True,
        )

    state.worker_thread = t
    t.start()
    return {"ok": True, "sourceType": req.sourceType, "areaPresetId": req.areaPresetId}


def stop_monitoring_internal() -> None:
    state.stop_event.set()
    if state.worker_thread and state.worker_thread.is_alive():
        state.worker_thread.join(timeout=2.5)
    with state.lock:
        state.running = False
        state.source_type = "idle"
        state.camera_index = None
        state.fps = 0.0
        state.latest_jpeg = render_idle_jpeg()
    detector.reset_state()


def _get_windows_camera_names() -> List[str]:
    if os.name != "nt":
        return []
    try:
        out = subprocess.check_output(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_PnPEntity -Filter \"PNPClass='Camera' OR PNPClass='Image'\" | Where-Object { $_.Status -eq 'OK' } | Select-Object -ExpandProperty Name",
            ],
            timeout=3.0,
            text=True,
        )
        return [line.strip() for line in out.splitlines() if line.strip()]
    except Exception:
        return []


@app.get("/cameras")
def list_connected_cameras() -> Dict[str, Any]:
    """
    Enumerates connected OpenCV camera indices (0..5) without disrupting an active stream.
    """
    with state.lock:
        active_idx = state.camera_index if state.running and state.source_type == "webcam" else None

    pnp_names = _get_windows_camera_names()
    cameras: List[Dict[str, Any]] = []

    for idx in range(6):
        if active_idx is not None and idx == active_idx:
            cameras.append(
                {
                    "index": idx,
                    "label": f"Camera #{idx} (Active Stream)",
                    "width": 640,
                    "height": 480,
                    "active": True,
                }
            )
            continue

        cap = cv2.VideoCapture(idx)
        if not cap.isOpened() and os.name == "nt":
            cap.release()
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
            cap.release()
            hint = pnp_names[idx] if idx < len(pnp_names) else None
            cameras.append(
                {
                    "index": idx,
                    "label": f"{hint} — Camera #{idx} ({w}x{h})" if hint else f"Camera #{idx} ({w}x{h})",
                    "width": w,
                    "height": h,
                    "active": False,
                }
            )
        else:
            cap.release()

    return {"cameras": cameras, "deviceHints": pnp_names}


@app.post("/monitoring/stop")
def stop_monitoring(x_hershield_ai_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    verify_secret(x_hershield_ai_secret)
    stop_monitoring_internal()
    return {"ok": True}


@app.get("/stream")
async def mjpeg_stream(request: Request) -> StreamingResponse:
    async def frame_generator():
        last_frame_bytes = None
        while True:
            if await request.is_disconnected():
                break
            with state.lock:
                frame_bytes = state.latest_jpeg
            if frame_bytes and frame_bytes is not last_frame_bytes:
                last_frame_bytes = frame_bytes
                yield (
                    b"--frame\r\nContent-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(frame_bytes)}\r\n\r\n".encode("ascii")
                    + frame_bytes
                    + b"\r\n"
                )
            await asyncio.sleep(0.02)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/frame.jpg")
def latest_frame() -> Response:
    with state.lock:
        frame_bytes = state.latest_jpeg or render_idle_jpeg()
    return Response(
        content=frame_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@app.post("/video/upload")
async def upload_and_process_video(
    file: UploadFile = File(...),
    areaPresetId: str = Form(default="indiranagar-100ft"),
    x_hershield_ai_secret: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    verify_secret(x_hershield_ai_secret)

    safe_name = Path(file.filename or "uploaded_video.mp4").name
    ext = Path(safe_name).suffix.lower()
    if ext not in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        raise HTTPException(status_code=400, detail="Unsupported video format. Upload .mp4, .avi, .mov, .mkv, or .webm.")

    dest = UPLOADS_DIR / f"{int(time.time())}_{safe_name}"
    contents = await file.read()
    dest.write_bytes(contents)

    with state.lock:
        state.upload_status = {
            "status": "processing",
            "fileName": safe_name,
            "progressPct": 0,
            "framesProcessed": 0,
            "totalFrames": 0,
            "measuredFps": 0.0,
            "incidents": [],
            "error": None,
        }

    def process_file():
        cap = cv2.VideoCapture(str(dest))
        if not cap.isOpened():
            with state.lock:
                state.upload_status["status"] = "error"
                state.upload_status["error"] = f"OpenCV could not decode '{safe_name}'."
            return

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        raw_fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
        video_fps = raw_fps if 5.0 <= raw_fps <= 120.0 else 30.0
        local_detector = HerShieldDetector()
        local_buffer = PrivacyShieldBuffer(max_seconds=12.0, approx_fps=12.0)
        processed = 0
        t_begin = time.time()
        found_incidents: List[Dict[str, Any]] = []

        try:
            frame_idx = 0
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    break
                frame_idx += 1
                # Process every 2nd frame on high-FPS videos to maintain smooth speed
                if frame_idx % 2 == 1:
                    annotated, snap, events = local_detector.process_frame(
                        frame,
                        aggression_threshold=state.aggression_threshold,
                        collapse_confirm_seconds=state.collapse_confirm_seconds,
                        frame_time=frame_idx / video_fps,
                    )
                    local_buffer.push(snap)
                    processed += 1
                    for ev in events:
                        inc = push_incident_to_app(
                            ev,
                            camera_source=f"uploaded:{safe_name}",
                            area_preset_id=areaPresetId,
                            snapshots=list(local_buffer.buffer),
                            is_simulated_demo=False,
                        )
                        found_incidents.append(inc)

                    ok, buf = cv2.imencode(".jpg", draw_hud(annotated, processed / max(0.1, time.time() - t_begin), 0.0, safe_name))
                    if ok:
                        with state.lock:
                            state.latest_jpeg = buf.tobytes()

                elapsed_total = max(0.1, time.time() - t_begin)
                with state.lock:
                    state.upload_status.update(
                        {
                            "totalFrames": total,
                            "framesProcessed": processed,
                            "progressPct": min(99, int((frame_idx / max(1, total)) * 100)) if total > 0 else 50,
                            "measuredFps": round(processed / elapsed_total, 1),
                            "incidents": found_incidents,
                        }
                    )
        finally:
            cap.release()
            elapsed_total = max(0.1, time.time() - t_begin)
            with state.lock:
                state.upload_status.update(
                    {
                        "status": "completed",
                        "progressPct": 100,
                        "framesProcessed": processed,
                        "measuredFps": round(processed / elapsed_total, 1),
                        "incidents": found_incidents,
                    }
                )
            # PrivacyShield: remove temporary uploaded raw footage after processing
            try:
                dest.unlink(missing_ok=True)
            except Exception:
                pass

    threading.Thread(target=process_file, daemon=True).start()
    return {"ok": True, "fileName": safe_name, "status": "processing"}


@app.get("/upload/status")
def get_upload_status() -> Dict[str, Any]:
    with state.lock:
        return dict(state.upload_status)


@app.get("/privacy/preview/{incident_id}")
def get_sanitized_preview(incident_id: str) -> FileResponse:
    safe_id = Path(incident_id).name
    path = PREVIEWS_DIR / f"{safe_id}_sanitized.mp4"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Sanitized PrivacyShield preview not found.")
    return FileResponse(path, media_type="video/mp4", filename=f"{safe_id}_privacyshield.mp4")


@app.post("/benchmark")
def run_benchmark(x_hershield_ai_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    verify_secret(x_hershield_ai_secret)
    if detector.model is None:
        return {"ok": False, "error": detector.model_error or "Model not loaded"}

    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    # Warmup
    detector.model.predict(dummy, imgsz=INFERENCE_SIZE, device=detector.device, verbose=False)

    n_frames = 25
    t0 = time.time()
    for _ in range(n_frames):
        detector.model.predict(dummy, imgsz=INFERENCE_SIZE, device=detector.device, verbose=False)
    dt = max(0.001, time.time() - t0)

    return {
        "ok": True,
        "frames": n_frames,
        "resolution": INFERENCE_SIZE,
        "device": "cuda" if detector.device != "cpu" else "cpu",
        "gpuName": detector.gpu_name,
        "totalSeconds": round(dt, 2),
        "avgInferenceMs": round((dt / n_frames) * 1000.0, 1),
        "measuredFps": round(n_frames / dt, 1),
    }


@app.websocket("/ws/status")
async def ws_status(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_text(json.dumps(health()))
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=AI_HOST, port=AI_PORT, reload=False)
