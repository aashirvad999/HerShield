import hashlib
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

import cv2
import numpy as np

from config import PREVIEWS_DIR, PRIVACY_BUFFER_PRE_SECONDS


@dataclass
class SanitizedFrameSnapshot:
    timestamp: float
    width: int
    height: int
    boxes: List[Dict[str, Any]] = field(default_factory=list)
    keypoints_list: List[List[List[float]]] = field(default_factory=list)
    label: str = "Monitoring"
    frame_jpeg: Optional[bytes] = None


def _blur_region(img: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> None:
    """Applies strong Gaussian blur in-place to a clamped rectangular region."""
    h, w = img.shape[:2]
    cx1 = max(0, min(w - 1, x1))
    cy1 = max(0, min(h - 1, y1))
    cx2 = max(cx1 + 1, min(w, x2))
    cy2 = max(cy1 + 1, min(h, y2))
    roi = img[cy1:cy2, cx1:cx2]
    if roi.size == 0:
        return
    # Pixelate + strong Gaussian blur so faces cannot be reconstructed
    rw, rh = roi.shape[1], roi.shape[0]
    small_w = max(4, rw // 10)
    small_h = max(4, rh // 10)
    pixelated = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
    pixelated = cv2.resize(pixelated, (rw, rh), interpolation=cv2.INTER_NEAREST)
    blurred = cv2.GaussianBlur(pixelated, (35, 35), 20)
    img[cy1:cy2, cx1:cx2] = blurred


def _blur_faces_on_frame(
    img: np.ndarray,
    boxes: List[Dict[str, Any]],
    keypoints_list: List[List[List[float]]],
    scale_x: float,
    scale_y: float,
) -> np.ndarray:
    """Blurs every detected person's face using pose head keypoints or upper-box fallback."""
    for idx, box in enumerate(boxes):
        bx1 = int(box["x1"] * scale_x)
        by1 = int(box["y1"] * scale_y)
        bx2 = int(box["x2"] * scale_x)
        by2 = int(box["y2"] * scale_y)
        bh = max(20, by2 - by1)
        bw = max(20, bx2 - bx1)

        head_pts = []
        if idx < len(keypoints_list):
            kps = keypoints_list[idx]
            for j in range(min(5, len(kps))):
                if kps[j][2] > 0.20:
                    head_pts.append((kps[j][0] * scale_x, kps[j][1] * scale_y))

        if head_pts:
            xs = [p[0] for p in head_pts]
            ys = [p[1] for p in head_pts]
            span = max(max(xs) - min(xs), max(ys) - min(ys))
            pad = max(18, int(max(span * 0.85, bh * 0.11)))
            fx1 = int(min(xs) - pad)
            fy1 = int(min(ys) - pad * 1.1)
            fx2 = int(max(xs) + pad)
            fy2 = int(max(ys) + pad * 0.9)
        else:
            # Fallback: blur upper head region of bounding box
            fx1 = bx1 + int(bw * 0.15)
            fx2 = bx2 - int(bw * 0.15)
            fy1 = by1
            fy2 = by1 + int(bh * 0.24)

        _blur_region(img, fx1, fy1, fx2, fy2)
    return img


class PrivacyShieldBuffer:
    """
    Maintains a rolling in-memory buffer of recent frames and pose metadata
    so volunteer incident previews can be exported with all faces blurred.
    """

    def __init__(self, max_seconds: float = 12.0, approx_fps: float = 15.0) -> None:
        self.max_frames = max(30, int(max_seconds * approx_fps))
        self.buffer: Deque[SanitizedFrameSnapshot] = deque(maxlen=self.max_frames)

    def push(self, snapshot: SanitizedFrameSnapshot) -> None:
        self.buffer.append(snapshot)

    def clear(self) -> None:
        self.buffer.clear()

    def render_sanitized_preview(
        self,
        incident_id: str,
        incident_title: str,
        snapshots: Optional[List[SanitizedFrameSnapshot]] = None,
        fps: float = 10.0,
    ) -> Dict[str, Any]:
        """
        Exports a face-blurred WebM video clip (browser-playable) of the incident
        window without vector skeleton overlays, and computes its SHA-256 hash.
        """
        frames = snapshots if snapshots is not None else list(self.buffer)
        if not frames:
            frames = [
                SanitizedFrameSnapshot(
                    timestamp=time.time(),
                    width=640,
                    height=480,
                    label=incident_title,
                )
            ]

        now_ts = frames[-1].timestamp
        cutoff = now_ts - max(PRIVACY_BUFFER_PRE_SECONDS + 2.0, 5.0)
        window = [f for f in frames if f.timestamp >= cutoff] or frames[-30:]

        out_w, out_h = 640, 480
        out_path = PREVIEWS_DIR / f"{incident_id}_sanitized.webm"
        fourcc = cv2.VideoWriter_fourcc(*"VP80")
        writer = cv2.VideoWriter(
            str(out_path),
            fourcc,
            max(4.0, min(fps, 15.0)),
            (out_w, out_h),
        )
        if not writer.isOpened():
            out_path = PREVIEWS_DIR / f"{incident_id}_sanitized.mp4"
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(
                str(out_path),
                fourcc,
                max(4.0, min(fps, 15.0)),
                (out_w, out_h),
            )

        t0 = window[0].timestamp

        for snap in window:
            img = None
            if snap.frame_jpeg:
                arr = np.frombuffer(snap.frame_jpeg, dtype=np.uint8)
                decoded = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if decoded is not None:
                    if decoded.shape[1] != out_w or decoded.shape[0] != out_h:
                        img = cv2.resize(decoded, (out_w, out_h), interpolation=cv2.INTER_AREA)
                    else:
                        img = decoded

            if img is None:
                img = np.full((out_h, out_w, 3), (31, 14, 22), dtype=np.uint8)
                cv2.putText(
                    img,
                    snap.label or incident_title,
                    (24, out_h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (228, 163, 190),
                    2,
                    cv2.LINE_AA,
                )
            else:
                scale_x = out_w / max(1, snap.width)
                scale_y = out_h / max(1, snap.height)
                img = _blur_faces_on_frame(
                    img,
                    snap.boxes,
                    snap.keypoints_list,
                    scale_x,
                    scale_y,
                )

            cv2.rectangle(img, (0, 0), (out_w, 30), (22, 14, 31), -1)
            cv2.putText(
                img,
                f"HERSHIELD FACE-BLURRED PREVIEW | {incident_id} | t+{snap.timestamp - t0:.1f}s",
                (12, 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (248, 245, 250),
                1,
                cv2.LINE_AA,
            )
            writer.write(img)

        writer.release()

        sha256_hex = None
        if out_path.exists():
            h = hashlib.sha256()
            with out_path.open("rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    h.update(chunk)
            sha256_hex = h.hexdigest()

        return {
            "preview_path": str(out_path),
            "preview_reference": f"/api/ai-proxy/privacy/preview/{incident_id}",
            "preview_sha256": sha256_hex,
            "timeline_frames": [],
            "frame_count": len(window),
        }
