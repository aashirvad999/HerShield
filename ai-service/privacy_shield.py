import hashlib
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

import cv2
import numpy as np

from config import PREVIEWS_DIR, PRIVACY_BUFFER_PRE_SECONDS

# COCO 17-keypoint skeleton bone connections
COCO_EDGES = [
    (0, 1), (0, 2), (1, 3), (2, 4),
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
    (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16),
]


@dataclass
class SanitizedFrameSnapshot:
    timestamp: float
    width: int
    height: int
    boxes: List[Dict[str, Any]] = field(default_factory=list)
    keypoints_list: List[List[List[float]]] = field(default_factory=list)
    label: str = "Monitoring"


class PrivacyShieldBuffer:
    """
    Maintains a rolling in-memory buffer of ONLY pose keypoints and anonymized boxes.
    Raw camera frames are processed transiently in RAM and never saved for volunteer distribution.
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
        Draws non-identifying stick-figure skeletons on a blank Deep Plum (#160E1F) canvas,
        exports a short local MP4 preview, computes SHA-256 integrity hash, and returns
        both file metadata and lightweight timeline keyframes for UI rendering.
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
        out_path = PREVIEWS_DIR / f"{incident_id}_sanitized.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(out_path), fourcc, max(4.0, min(fps, 15.0)), (out_w, out_h))

        timeline_frames: List[Dict[str, Any]] = []
        t0 = window[0].timestamp

        for idx, snap in enumerate(window):
            canvas = np.full((out_h, out_w, 3), (31, 14, 22), dtype=np.uint8)  # BGR for #160E1F

            # Subtle grid lines for spatial context without any identifiable surroundings
            for gx in range(80, out_w, 80):
                cv2.line(canvas, (gx, 0), (gx, out_h), (48, 28, 56), 1)
            for gy in range(80, out_h, 80):
                cv2.line(canvas, (0, gy), (out_w, gy), (48, 28, 56), 1)

            scale_x = out_w / max(1, snap.width)
            scale_y = out_h / max(1, snap.height)

            scaled_boxes = []
            for box in snap.boxes:
                x1 = int(box["x1"] * scale_x)
                y1 = int(box["y1"] * scale_y)
                x2 = int(box["x2"] * scale_x)
                y2 = int(box["y2"] * scale_y)
                tid = int(box.get("trackId", 0))
                scaled_boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "trackId": tid})
                cv2.rectangle(canvas, (x1, y1), (x2, y2), (228, 163, 190), 1, cv2.LINE_AA)
                cv2.putText(
                    canvas,
                    f"Subject #{tid}",
                    (x1, max(20, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.45,
                    (228, 163, 190),
                    1,
                    cv2.LINE_AA,
                )

            primary_kps: List[List[float]] = []
            for kps in snap.keypoints_list:
                scaled_kps = [
                    [float(kp[0] * scale_x), float(kp[1] * scale_y), float(kp[2])]
                    for kp in kps
                ]
                if not primary_kps and scaled_kps:
                    primary_kps = [[round(v, 1) for v in kp] for kp in scaled_kps]

                for a, b in COCO_EDGES:
                    if a < len(scaled_kps) and b < len(scaled_kps):
                        ka, kb = scaled_kps[a], scaled_kps[b]
                        if ka[2] > 0.25 and kb[2] > 0.25:
                            cv2.line(
                                canvas,
                                (int(ka[0]), int(ka[1])),
                                (int(kb[0]), int(kb[1])),
                                (168, 70, 217),  # BGR Magenta #D946A8
                                3,
                                cv2.LINE_AA,
                            )

                for j_idx, kp in enumerate(scaled_kps):
                    if kp[2] > 0.25:
                        # Replace head keypoints (0..4) with a clean anonymous head marker at nose
                        if j_idx in (1, 2, 3, 4):
                            continue
                        radius = 10 if j_idx == 0 else 4
                        color = (228, 163, 190) if j_idx == 0 else (235, 220, 243)
                        thickness = 2 if j_idx == 0 else -1
                        cv2.circle(
                            canvas,
                            (int(kp[0]), int(kp[1])),
                            radius,
                            color,
                            thickness,
                            cv2.LINE_AA,
                        )

            cv2.rectangle(canvas, (0, 0), (out_w, 34), (42, 22, 48), -1)
            cv2.putText(
                canvas,
                f"PRIVACYSHIELD NON-IDENTIFYING PREVIEW | {incident_id}",
                (14, 22),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (248, 245, 250),
                1,
                cv2.LINE_AA,
            )
            cv2.putText(
                canvas,
                f"{snap.label} | t+{snap.timestamp - t0:.1f}s",
                (14, out_h - 14),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (190, 163, 228),
                1,
                cv2.LINE_AA,
            )

            writer.write(canvas)

            # Sample up to ~24 keyframes for fast JSON UI playback
            step = max(1, len(window) // 24)
            if idx % step == 0 or idx == len(window) - 1:
                timeline_frames.append(
                    {
                        "t": round(snap.timestamp - t0, 2),
                        "keypoints": primary_kps,
                        "boxes": scaled_boxes,
                        "label": snap.label,
                    }
                )

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
            "timeline_frames": timeline_frames,
            "frame_count": len(window),
        }
