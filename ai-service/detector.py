import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional, Tuple, Set

import cv2
import numpy as np

from config import (
    AGGRESSION_CONFIDENCE_THRESHOLD,
    COLLAPSE_CONFIRM_SECONDS,
    INFERENCE_SIZE,
    MODEL_CONFIDENCE_THRESHOLD,
    MODEL_DEVICE,
)
from privacy_shield import SanitizedFrameSnapshot


@dataclass
class TrackHistory:
    centers: Deque[Tuple[float, float, float]] = field(default_factory=lambda: deque(maxlen=30))
    heights: Deque[float] = field(default_factory=lambda: deque(maxlen=30))
    left_wrists: Deque[Tuple[float, float, float]] = field(default_factory=lambda: deque(maxlen=20))
    right_wrists: Deque[Tuple[float, float, float]] = field(default_factory=lambda: deque(maxlen=20))
    heads: Deque[Tuple[float, float, float]] = field(default_factory=lambda: deque(maxlen=20))
    upright_frames: int = 0
    baseline_bh: float = 0.0
    baseline_cy: float = 0.0
    was_standing: bool = False
    fallen_since: Optional[float] = None
    not_fallen_frames: int = 0
    collapse_alerted: bool = False
    chest_clutch_since: Optional[float] = None
    chest_clutch_alerted: bool = False
    last_seen: float = 0.0


@dataclass
class PairInteractionHistory:
    last_seen: float = 0.0
    dist_history: Deque[Tuple[float, float]] = field(default_factory=lambda: deque(maxlen=35))
    close_since: Optional[float] = None
    close_last_true: float = 0.0
    grab_since: Optional[float] = None
    grab_last_true: float = 0.0
    neck_reach_at: Optional[float] = None
    neck_reach_min_dist: float = 999.0
    neck_reach_actor: Optional[int] = None
    slap_window: Deque[Tuple[float, int, float, float, float]] = field(default_factory=lambda: deque(maxlen=10))
    aggression_streak: int = 0
    last_alert_at: Dict[str, float] = field(default_factory=dict)
    last_any_alert_at: float = 0.0


def _update_point_velocity(
    history: Deque[Tuple[float, float, float]],
    pt: Optional[Tuple[float, float]],
    now: float,
    norm_scale: float,
) -> float:
    """Appends a tracked point and returns its height-normalized speed (body-heights/sec)."""
    if pt is None:
        return 0.0
    speed = 0.0
    if history:
        px, py, ptime = history[-1]
        dt = now - ptime
        if 0.02 <= dt <= 0.6:
            speed = math.hypot(pt[0] - px, pt[1] - py) / (dt * max(40.0, norm_scale))
    history.append((pt[0], pt[1], now))
    return speed


class DisplayIdManager:
    """
    Maps raw ByteTrack IDs (which increment to 16, 68, etc.) to intuitive,
    stable person numbers (1, 2, 3...) for persons currently in frame.
    Keeps ID assignments stable across frames and reuses the lowest free numbers
    when persons leave the frame.
    """
    def __init__(self, timeout_seconds: float = 3.0) -> None:
        self.raw_to_display: Dict[int, int] = {}
        self.display_last_seen: Dict[int, float] = {}
        self.timeout_seconds = timeout_seconds

    def update(self, raw_ids: List[int], boxes_x1: List[float], now: float) -> List[int]:
        active_raw = set(raw_ids)
        stale_raw = [
            r for r, d in self.raw_to_display.items()
            if r not in active_raw and (now - self.display_last_seen.get(d, 0) > self.timeout_seconds)
        ]
        for r in stale_raw:
            d = self.raw_to_display.pop(r, None)
            if d is not None:
                self.display_last_seen.pop(d, None)

        current_allocated = {d for r, d in self.raw_to_display.items() if r in active_raw}
        unassigned = [
            (raw_id, x1)
            for raw_id, x1 in zip(raw_ids, boxes_x1)
            if raw_id not in self.raw_to_display
        ]
        unassigned.sort(key=lambda item: item[1])

        for raw_id, _ in unassigned:
            candidate = 1
            while candidate in current_allocated:
                candidate += 1
            self.raw_to_display[raw_id] = candidate
            current_allocated.add(candidate)

        display_ids = []
        for raw_id in raw_ids:
            d = self.raw_to_display[raw_id]
            self.display_last_seen[d] = now
            display_ids.append(d)

        return display_ids

    def reset(self) -> None:
        self.raw_to_display.clear()
        self.display_last_seen.clear()


class HerShieldDetector:
    def __init__(self) -> None:
        self.device = "cpu"
        self.gpu_name: Optional[str] = None
        self.model = None
        self.model_error: Optional[str] = None
        self.tracks: Dict[int, TrackHistory] = {}
        self.pairs: Dict[Tuple[int, int], PairInteractionHistory] = {}
        self.id_manager = DisplayIdManager()
        self.aggression_streak: int = 0
        self.last_aggression_alert_at: float = 0.0
        self.active_collapse_timer: Dict[str, Any] = {
            "active": False,
            "trackId": None,
            "elapsedSeconds": 0.0,
            "remainingSeconds": COLLAPSE_CONFIRM_SECONDS,
            "requiredSeconds": COLLAPSE_CONFIRM_SECONDS,
        }
        self._load_model()

    def _load_model(self) -> None:
        try:
            import torch
            from ultralytics import YOLO

            if MODEL_DEVICE == "cpu":
                self.device = "cpu"
            elif torch.cuda.is_available():
                self.device = "0"
                self.gpu_name = torch.cuda.get_device_name(0)
            else:
                self.device = "cpu"

            # Single lightweight pose+person model avoids loading multiple heavy models
            self.model = YOLO("yolo11n-pose.pt")
            # Pre-warm CUDA/CPU inference kernels so first live webcam frame is instant
            warmup_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            self.model.predict(
                warmup_frame,
                imgsz=INFERENCE_SIZE,
                device=self.device,
                verbose=False,
            )
            self.model_error = None
        except Exception as exc:
            self.model = None
            self.model_error = f"Model load error: {exc}"

    def reset_state(self) -> None:
        self.tracks.clear()
        self.pairs.clear()
        self.id_manager.reset()
        self.aggression_streak = 0
        self.last_aggression_alert_at = 0.0
        self.active_collapse_timer = {
            "active": False,
            "trackId": None,
            "elapsedSeconds": 0.0,
            "remainingSeconds": COLLAPSE_CONFIRM_SECONDS,
            "requiredSeconds": COLLAPSE_CONFIRM_SECONDS,
        }

    def process_frame(
        self,
        frame: np.ndarray,
        aggression_threshold: Optional[float] = None,
        collapse_confirm_seconds: Optional[float] = None,
        frame_time: Optional[float] = None,
    ) -> Tuple[np.ndarray, SanitizedFrameSnapshot, List[Dict[str, Any]]]:
        """
        Runs YOLO11n-pose + ByteTrack on a frame, draws operator overlays,
        evaluates slap / harassment / chain-snatching / aggression / collapse /
        chest-clutching heuristics, and returns
        (annotated_operator_frame, sanitized_snapshot, triggered_events).
        """
        now = frame_time if frame_time is not None else time.time()
        h_img, w_img = frame.shape[:2]
        annotated = frame.copy()
        agg_thresh = aggression_threshold or AGGRESSION_CONFIDENCE_THRESHOLD
        collapse_req = collapse_confirm_seconds or COLLAPSE_CONFIRM_SECONDS

        if self.model is None:
            cv2.putText(
                annotated,
                self.model_error or "AI Model unavailable",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (168, 70, 217),
                2,
            )
            return (
                annotated,
                SanitizedFrameSnapshot(timestamp=now, width=w_img, height=h_img, label="Model unavailable"),
                [],
            )

        try:
            results = self.model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=[0],
                conf=MODEL_CONFIDENCE_THRESHOLD,
                imgsz=INFERENCE_SIZE,
                device=self.device,
                verbose=False,
            )
        except RuntimeError as exc:
            # Graceful CUDA OOM or device fallback to CPU
            if "cuda" in str(exc).lower() and self.device != "cpu":
                self.device = "cpu"
                self.gpu_name = None
                results = self.model.track(
                    frame,
                    persist=True,
                    tracker="bytetrack.yaml",
                    classes=[0],
                    conf=MODEL_CONFIDENCE_THRESHOLD,
                    imgsz=INFERENCE_SIZE,
                    device="cpu",
                    verbose=False,
                )
            else:
                raise

        r = results[0]
        if r.boxes is not None and len(r.boxes) > 0:
            xyxy_arr = r.boxes.xyxy.cpu().numpy()
            raw_ids_arr = (
                r.boxes.id.int().cpu().tolist()
                if r.boxes.id is not None
                else list(range(1, len(xyxy_arr) + 1))
            )
            boxes_x1 = [float(b[0]) for b in xyxy_arr]
            ids_arr = self.id_manager.update(raw_ids_arr, boxes_x1, now)
            kps_arr = (
                r.keypoints.data.cpu().numpy()
                if r.keypoints is not None and r.keypoints.data is not None
                else None
            )
        else:
            xyxy_arr = []
            ids_arr = []
            kps_arr = None

        return self._analyze_detections(
            annotated=annotated,
            xyxy_arr=xyxy_arr,
            ids_arr=ids_arr,
            kps_arr=kps_arr,
            now=now,
            w_img=w_img,
            h_img=h_img,
            agg_thresh=agg_thresh,
            collapse_req=collapse_req,
        )

    def _extract_pose_features(
        self,
        kps_list: List[List[float]],
        hist: TrackHistory,
        x1: float,
        y1: float,
        cx: float,
        bh: float,
        now: float,
    ) -> Dict[str, Any]:
        """Extracts dual-wrist speeds, head/neck/torso anchors, torso angle, and defensive/chest cues."""
        lw_pt = (kps_list[9][0], kps_list[9][1]) if len(kps_list) > 9 and kps_list[9][2] > 0.35 else None
        rw_pt = (kps_list[10][0], kps_list[10][1]) if len(kps_list) > 10 and kps_list[10][2] > 0.35 else None
        lw_speed = _update_point_velocity(hist.left_wrists, lw_pt, now, bh)
        rw_speed = _update_point_velocity(hist.right_wrists, rw_pt, now, bh)
        wrist_speed = max(lw_speed, rw_speed)

        # Head anchor (nose or visible face points; fallback to upper bbox)
        head_pt: Tuple[float, float] = (cx, y1 + 0.14 * bh)
        if len(kps_list) >= 5:
            if kps_list[0][2] > 0.3:
                head_pt = (kps_list[0][0], kps_list[0][1])
            else:
                vis_head = [(kps_list[idx][0], kps_list[idx][1]) for idx in range(5) if kps_list[idx][2] > 0.3]
                if vis_head:
                    head_pt = (
                        sum(p[0] for p in vis_head) / len(vis_head),
                        sum(p[1] for p in vis_head) / len(vis_head),
                    )
        head_speed = _update_point_velocity(hist.heads, head_pt, now, bh)

        neck_pt: Tuple[float, float] = (cx, y1 + 0.25 * bh)
        torso_pt: Tuple[float, float] = (cx, y1 + 0.38 * bh)
        pose_horizontal = False
        pose_upright_torso = False
        chest_clutch = False
        defensive_hands = False

        if len(kps_list) >= 17:
            ls, rs = kps_list[5], kps_list[6]
            lh, rh = kps_list[11], kps_list[12]
            shoulders_ok = ls[2] > 0.3 and rs[2] > 0.3
            hips_ok = lh[2] > 0.3 and rh[2] > 0.3

            if shoulders_ok:
                sh_x, sh_y = (ls[0] + rs[0]) / 2.0, (ls[1] + rs[1]) / 2.0
                # Neck/chain anchor sits slightly above shoulder midpoint toward head
                neck_pt = (
                    0.5 * (head_pt[0] + sh_x),
                    sh_y - 0.15 * max(0.0, sh_y - head_pt[1]),
                )
                torso_pt = (sh_x, sh_y + 0.12 * bh)
                sh_w = max(20.0, math.hypot(ls[0] - rs[0], ls[1] - rs[1]))

                for w_pt in (lw_pt, rw_pt):
                    if w_pt is not None and w_pt[1] <= sh_y + 0.12 * bh and math.hypot(w_pt[0] - sh_x, w_pt[1] - sh_y) < sh_w * 0.95:
                        defensive_hands = True

                if hips_ok:
                    hp_x, hp_y = (lh[0] + rh[0]) / 2.0, (lh[1] + rh[1]) / 2.0
                    torso_pt = ((sh_x + hp_x) / 2.0, (sh_y + hp_y) / 2.0)
                    torso_dx = abs(sh_x - hp_x)
                    torso_dy = abs(sh_y - hp_y)
                    if torso_dx > torso_dy * 1.25:
                        pose_horizontal = True
                    elif torso_dy >= torso_dx * 1.15:
                        pose_upright_torso = True

                    # Experimental chest-clutching gesture (never medical diagnosis)
                    chest_x, chest_y = sh_x, sh_y + 0.25 * torso_dy
                    near_chest = any(
                        w_pt is not None and math.hypot(w_pt[0] - chest_x, w_pt[1] - chest_y) < sh_w * 0.65
                        for w_pt in (lw_pt, rw_pt)
                    )
                    if near_chest and torso_dy > 10:
                        if hist.chest_clutch_since is None:
                            hist.chest_clutch_since = now
                        elif now - hist.chest_clutch_since >= 1.8 and not hist.chest_clutch_alerted:
                            chest_clutch = True
                    else:
                        hist.chest_clutch_since = None
                        hist.chest_clutch_alerted = False

        return {
            "lw": lw_pt,
            "rw": rw_pt,
            "lwSpeed": lw_speed,
            "rwSpeed": rw_speed,
            "wristSpeed": wrist_speed,
            "head": head_pt,
            "headSpeed": head_speed,
            "neck": neck_pt,
            "torso": torso_pt,
            "poseHorizontal": pose_horizontal,
            "poseUprightTorso": pose_upright_torso,
            "chestClutch": chest_clutch,
            "defensiveHands": defensive_hands,
        }

    def _evaluate_collapse(
        self,
        tid: int,
        hist: TrackHistory,
        x1: float,
        y1: float,
        y2: float,
        cx: float,
        cy: float,
        bh: float,
        aspect: float,
        pose_horizontal: bool,
        pose_upright_torso: bool,
        w_img: int,
        h_img: int,
        now: float,
        collapse_req: float,
        annotated: np.ndarray,
        events: List[Dict[str, Any]],
    ) -> bool:
        """
        Strict collapse detector: requires multi-frame upright baseline followed by
        genuine vertical height drop + horizontal/ground posture. Prevents false collapse
        triggers on close-up webcam crops, wide arm extensions, or brief bending.
        """
        close_bottom_crop = (y2 >= h_img * 0.96) and not pose_horizontal
        is_upright = (
            (not pose_horizontal)
            and (bh >= h_img * 0.18)
            and (aspect < 0.92 or (pose_upright_torso and aspect < 1.12))
        )

        if is_upright:
            hist.upright_frames += 1
            hist.baseline_bh = bh if hist.baseline_bh <= 0 else (0.85 * hist.baseline_bh + 0.15 * bh)
            hist.baseline_cy = cy if hist.baseline_cy <= 0 else (0.85 * hist.baseline_cy + 0.15 * cy)
            if hist.upright_frames >= 4:
                hist.was_standing = True
            hist.fallen_since = None
            hist.not_fallen_frames = 0
            hist.collapse_alerted = False
            return False

        is_fallen = False
        if hist.was_standing and hist.baseline_bh > 0 and not close_bottom_crop:
            height_dropped = bh < hist.baseline_bh * 0.66
            center_dropped = (cy > hist.baseline_cy + hist.baseline_bh * 0.12) or (cy > h_img * 0.50)
            horiz_collapse = pose_horizontal and (bh < hist.baseline_bh * 0.74 or center_dropped)
            box_collapse = (aspect >= 1.22) and height_dropped and center_dropped
            is_fallen = (horiz_collapse or box_collapse) and (cy > h_img * 0.35)

        if is_fallen:
            hist.not_fallen_frames = 0
            if hist.fallen_since is None:
                hist.fallen_since = now
            elapsed = now - hist.fallen_since
            remaining = max(0.0, collapse_req - elapsed)
            self.active_collapse_timer = {
                "active": True,
                "trackId": tid,
                "elapsedSeconds": round(elapsed, 1),
                "remainingSeconds": round(remaining, 1),
                "requiredSeconds": collapse_req,
            }
            cv2.putText(
                annotated,
                f"COLLAPSE CHECK: {elapsed:.1f}s / {collapse_req:.0f}s",
                (int(x1), max(24, int(y1) - 24)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 190, 255),
                2,
            )
            if elapsed >= collapse_req and not hist.collapse_alerted:
                hist.collapse_alerted = True
                events.append(
                    {
                        "incidentType": "suspected_collapse",
                        "incidentConfidence": 78,
                        "confidenceType": "heuristic",
                        "confirmationStatus": "auto_confirmed",
                        "detectionExplanation": (
                            f"Tracked person #{tid} transitioned from upright posture (baseline height {hist.baseline_bh:.0f}px) "
                            f"to horizontal/ground level ({bh:.0f}px) and remained fallen for {elapsed:.1f}s "
                            f"(>= {collapse_req:.0f}s confirmation window). Requires human verification; not a medical diagnosis."
                        ),
                    }
                )
            return True

        hist.not_fallen_frames += 1
        if hist.not_fallen_frames >= 3:
            hist.fallen_since = None
            hist.collapse_alerted = False
        return False

    def _pair_directed_metrics(
        self, actor: Dict[str, Any], target: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Measures how closely an actor's wrists approach the target's head, neck, and torso."""
        t_bh = max(40.0, target["bh"])
        best_head = 999.0
        best_head_wspeed = 0.0
        best_neck = 999.0
        best_neck_wspeed = 0.0
        best_torso = 999.0
        best_torso_wspeed = 0.0

        for w_key, spd_key in (("lw", "lwSpeed"), ("rw", "rwSpeed")):
            w_pt = actor[w_key]
            if w_pt is None:
                continue
            w_spd = actor[spd_key]
            d_head = math.hypot(w_pt[0] - target["head"][0], w_pt[1] - target["head"][1]) / t_bh
            d_neck = math.hypot(w_pt[0] - target["neck"][0], w_pt[1] - target["neck"][1]) / t_bh
            d_torso = math.hypot(w_pt[0] - target["torso"][0], w_pt[1] - target["torso"][1]) / t_bh

            if d_head < best_head:
                best_head = d_head
                best_head_wspeed = w_spd
            if d_neck < best_neck:
                best_neck = d_neck
                best_neck_wspeed = w_spd
            if d_torso < best_torso:
                best_torso = d_torso
                best_torso_wspeed = w_spd

        return {
            "dHead": best_head,
            "headWSpeed": best_head_wspeed,
            "dNeck": best_neck,
            "neckWSpeed": best_neck_wspeed,
            "dTorso": best_torso,
            "torsoWSpeed": best_torso_wspeed,
        }

    def _can_emit(self, pair: PairInteractionHistory, inc_type: str, now: float, cooldown: float) -> bool:
        return (now - pair.last_alert_at.get(inc_type, -1e9)) >= cooldown

    def _record_emit(
        self,
        pair: PairInteractionHistory,
        event: Dict[str, Any],
        now: float,
        events: List[Dict[str, Any]],
        annotated: np.ndarray,
        pa: Dict[str, Any],
        pb: Dict[str, Any],
        overlay_text: str,
        color: Tuple[int, int, int],
    ) -> None:
        inc_type = event["incidentType"]
        pair.last_alert_at[inc_type] = now
        pair.last_any_alert_at = now
        events.append(event)
        mid_x = int((pa["cx"] + pb["cx"]) / 2.0)
        top_y = max(48, int(min(pa["y1"], pb["y1"])) - 12)
        cv2.putText(
            annotated,
            overlay_text,
            (max(12, mid_x - 110), top_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
            cv2.LINE_AA,
        )

    def _evaluate_pair_interaction(
        self,
        pa: Dict[str, Any],
        pb: Dict[str, Any],
        now: float,
        agg_thresh: float,
        annotated: np.ndarray,
        events: List[Dict[str, Any]],
    ) -> None:
        """
        Differentiates between chain snatching, slap/facial strike, physical aggression,
        and harassment using multi-frame wrist-to-target-zone and separation kinematics.
        """
        key = (min(pa["trackId"], pb["trackId"]), max(pa["trackId"], pb["trackId"]))
        pair = self.pairs.setdefault(key, PairInteractionHistory())
        pair.last_seen = now

        avg_h = max(40.0, (pa["bh"] + pb["bh"]) / 2.0)
        norm_dist = math.hypot(pa["cx"] - pb["cx"], pa["cy"] - pb["cy"]) / avg_h
        pair.dist_history.append((norm_dist, now))

        m_ab = self._pair_directed_metrics(pa, pb)
        m_ba = self._pair_directed_metrics(pb, pa)
        directed = ((pa, pb, m_ab), (pb, pa, m_ba))

        # 1. Chain Snatching: rapid reach to neck/upper-chest followed by rapid separation/fleeing
        for actor, target, m in directed:
            if norm_dist < 1.35 and m["dNeck"] < 0.38 and (m["neckWSpeed"] >= 0.90 or actor["bodySpeed"] >= 0.80):
                if pair.neck_reach_at is None or (now - pair.neck_reach_at) > 2.2:
                    pair.neck_reach_at = now
                    pair.neck_reach_min_dist = norm_dist
                    pair.neck_reach_actor = actor["trackId"]
                else:
                    pair.neck_reach_min_dist = min(pair.neck_reach_min_dist, norm_dist)

        if pair.neck_reach_at is not None:
            if (now - pair.neck_reach_at) <= 2.2:
                dist_gain = norm_dist - pair.neck_reach_min_dist
                actor_obj = pa if pair.neck_reach_actor == pa["trackId"] else pb
                flee_speed = actor_obj["bodySpeed"]
                if (dist_gain >= 0.30 and flee_speed >= 0.70) or (dist_gain >= 0.50 and norm_dist >= 0.95):
                    if self._can_emit(pair, "potential_chain_snatching", now, 10.0):
                        conf = min(90, max(68, int(64 + dist_gain * 24 + flee_speed * 8)))
                        self._record_emit(
                            pair,
                            {
                                "incidentType": "potential_chain_snatching",
                                "incidentConfidence": conf,
                                "confidenceType": "heuristic",
                                "confirmationStatus": "pending_timer",
                                "detectionExplanation": (
                                    f"Heuristic signal: Person #{pair.neck_reach_actor} reached rapidly into the "
                                    f"neck/upper-chest zone of Person #{pb['trackId'] if pair.neck_reach_actor == pa['trackId'] else pa['trackId']} "
                                    f"and separated rapidly (+{dist_gain:.2f} body-heights, flee speed {flee_speed:.2f}x)."
                                ),
                            },
                            now,
                            events,
                            annotated,
                            pa,
                            pb,
                            "CHAIN SNATCHING SIGNAL",
                            (0, 120, 255),
                        )
                    pair.neck_reach_at = None
                    pair.neck_reach_min_dist = 999.0
                    pair.neck_reach_actor = None
                    return
            else:
                pair.neck_reach_at = None
                pair.neck_reach_min_dist = 999.0
                pair.neck_reach_actor = None

        # 2. Slap / Facial Strike: impulsive high-velocity wrist strike toward head/face
        pair.slap_window = deque(
            (item for item in pair.slap_window if (now - item[0]) <= 0.50),
            maxlen=10,
        )
        slap_candidate: Optional[Tuple[int, int, float, float, float]] = None
        for actor, target, m in directed:
            head_target_hit = m["dHead"] < 0.44 and (m["dHead"] <= m["dNeck"] + 0.08)
            if norm_dist < 1.30 and head_target_hit and m["headWSpeed"] >= 2.05:
                pair.slap_window.append((now, actor["trackId"], m["headWSpeed"], m["dHead"], target["headSpeed"]))
                if (
                    (m["headWSpeed"] >= 2.35 and target["headSpeed"] >= 0.45)
                    or m["headWSpeed"] >= 2.65
                    or len(pair.slap_window) >= 2
                ):
                    slap_candidate = (
                        actor["trackId"],
                        target["trackId"],
                        m["headWSpeed"],
                        m["dHead"],
                        target["headSpeed"],
                    )

        if (
            slap_candidate is not None
            and pair.aggression_streak < 3
            and (now - pair.last_alert_at.get("potential_chain_snatching", -1e9)) > 2.5
            and self._can_emit(pair, "potential_slap", now, 8.0)
        ):
            a_id, t_id, w_spd, d_head, h_recoil = slap_candidate
            conf = min(89, max(66, int(60 + min(2.0, w_spd - 1.5) * 12 + (10 if h_recoil >= 0.45 else 0))))
            self._record_emit(
                pair,
                {
                    "incidentType": "potential_slap",
                    "incidentConfidence": conf,
                    "confidenceType": "heuristic",
                    "confirmationStatus": "pending_timer",
                    "detectionExplanation": (
                        f"Heuristic signal: Person #{a_id} delivered an impulsive high-velocity wrist strike "
                        f"({w_spd:.2f}x) within {d_head:.2f} body-heights of Person #{t_id}'s head/face "
                        f"(head recoil {h_recoil:.2f}x)."
                    ),
                },
                now,
                events,
                annotated,
                pa,
                pb,
                "SLAP / STRIKE SIGNAL",
                (168, 70, 217),
            )
            pair.slap_window.clear()
            return

        # 3. Physical Aggression / Brawl: sustained high-energy multi-frame combat
        combined_motion = max(pa["wristSpeed"], pb["wristSpeed"]) * 0.65 + (pa["bodySpeed"] + pb["bodySpeed"]) * 0.35
        pair_score = 0.0
        if norm_dist < 1.35:
            proximity_factor = max(0.0, (1.35 - norm_dist) / 1.35)
            motion_factor = min(1.0, combined_motion / 2.5)
            pair_score = 0.45 * proximity_factor + 0.55 * motion_factor

        if pair_score >= agg_thresh:
            pair.aggression_streak += 1
        else:
            pair.aggression_streak = max(0, pair.aggression_streak - 1)

        if (
            pair.aggression_streak >= 4
            and (now - pair.last_any_alert_at) > 2.5
            and self._can_emit(pair, "potential_aggression", now, 10.0)
        ):
            pair.aggression_streak = 0
            self.last_aggression_alert_at = now
            conf_pct = min(89, max(55, int(pair_score * 100)))
            self._record_emit(
                pair,
                {
                    "incidentType": "potential_aggression",
                    "incidentConfidence": conf_pct,
                    "confidenceType": "heuristic",
                    "confirmationStatus": "pending_timer",
                    "detectionExplanation": (
                        f"Heuristic signal: Persons #{pa['trackId']} & #{pb['trackId']} sustained close combat "
                        f"within {norm_dist:.2f} body-heights with elevated limb/body velocity ({combined_motion:.2f}x)."
                    ),
                },
                now,
                events,
                annotated,
                pa,
                pb,
                "AGGRESSION SIGNAL",
                (60, 60, 255),
            )
            return

        # 4. Harassment: sustained unwanted torso/arm grab or intrusive cornering with defensive/retreat cues
        best_d_torso = min(m_ab["dTorso"], m_ba["dTorso"])
        best_torso_wspeed = m_ab["torsoWSpeed"] if m_ab["dTorso"] <= m_ba["dTorso"] else m_ba["torsoWSpeed"]
        unwanted_grab = (norm_dist < 1.15) and (best_d_torso < 0.42) and (best_torso_wspeed < 1.9)
        intrusive_cornering = (norm_dist < 0.90) and (
            pa["defensiveHands"] or pb["defensiveHands"] or pa["bodySpeed"] > 0.20 or pb["bodySpeed"] > 0.20
        )

        if unwanted_grab:
            if pair.grab_since is None:
                pair.grab_since = now
            pair.grab_last_true = now
        elif pair.grab_since is not None and (now - pair.grab_last_true) > 0.4:
            pair.grab_since = None

        if intrusive_cornering:
            if pair.close_since is None:
                pair.close_since = now
            pair.close_last_true = now
        elif pair.close_since is not None and (now - pair.close_last_true) > 0.4:
            pair.close_since = None

        grab_dur = (now - pair.grab_since) if pair.grab_since is not None else 0.0
        close_dur = (now - pair.close_since) if pair.close_since is not None else 0.0

        if (
            (grab_dur >= 1.2 or close_dur >= 2.2)
            and (now - pair.last_any_alert_at) > 3.0
            and self._can_emit(pair, "potential_harassment", now, 12.0)
        ):
            reason = (
                f"sustained unwanted arm/torso contact ({grab_dur:.1f}s within {best_d_torso:.2f} body-heights)"
                if grab_dur >= 1.2
                else f"sustained intrusive proximity/cornering ({close_dur:.1f}s within {norm_dist:.2f} body-heights)"
            )
            conf_pct = min(84, max(62, int(60 + max(grab_dur * 8.0, close_dur * 5.0))))
            self._record_emit(
                pair,
                {
                    "incidentType": "potential_harassment",
                    "incidentConfidence": conf_pct,
                    "confidenceType": "heuristic",
                    "confirmationStatus": "pending_timer",
                    "detectionExplanation": (
                        f"Heuristic signal: Persons #{pa['trackId']} & #{pb['trackId']} exhibited {reason} "
                        "without high-speed brawling or collapse."
                    ),
                },
                now,
                events,
                annotated,
                pa,
                pb,
                "HARASSMENT SIGNAL",
                (0, 180, 255),
            )
            pair.grab_since = None
            pair.close_since = None

    def _analyze_detections(
        self,
        annotated: np.ndarray,
        xyxy_arr: Any,
        ids_arr: List[int],
        kps_arr: Any,
        now: float,
        w_img: int,
        h_img: int,
        agg_thresh: float,
        collapse_req: float,
    ) -> Tuple[np.ndarray, SanitizedFrameSnapshot, List[Dict[str, Any]]]:
        boxes_out: List[Dict[str, Any]] = []
        keypoints_out: List[List[List[float]]] = []
        events: List[Dict[str, Any]] = []
        person_states: List[Dict[str, Any]] = []

        for i, box in enumerate(xyxy_arr):
            x1, y1, x2, y2 = [float(v) for v in box[:4]]
            tid = int(ids_arr[i])
            bw = max(1.0, x2 - x1)
            bh = max(1.0, y2 - y1)
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            aspect = bw / bh

            hist = self.tracks.setdefault(tid, TrackHistory())
            hist.last_seen = now
            body_speed = _update_point_velocity(hist.centers, (cx, cy), now, bh)
            hist.heights.append(bh)

            kps_list: List[List[float]] = []
            if kps_arr is not None and i < len(kps_arr):
                kps = kps_arr[i]
                kps_list = [[float(kp[0]), float(kp[1]), float(kp[2])] for kp in kps]
                keypoints_out.append(kps_list)
                for kp in kps_list:
                    if kp[2] > 0.3:
                        cv2.circle(annotated, (int(kp[0]), int(kp[1])), 3, (228, 163, 190), -1)

            pose = self._extract_pose_features(kps_list, hist, x1, y1, cx, bh, now)

            is_fallen = self._evaluate_collapse(
                tid=tid,
                hist=hist,
                x1=x1,
                y1=y1,
                y2=y2,
                cx=cx,
                cy=cy,
                bh=bh,
                aspect=aspect,
                pose_horizontal=pose["poseHorizontal"],
                pose_upright_torso=pose["poseUprightTorso"],
                w_img=w_img,
                h_img=h_img,
                now=now,
                collapse_req=collapse_req,
                annotated=annotated,
                events=events,
            )

            if pose["chestClutch"]:
                hist.chest_clutch_alerted = True
                events.append(
                    {
                        "incidentType": "chest_clutching_warning",
                        "incidentConfidence": 48,
                        "confidenceType": "heuristic",
                        "confirmationStatus": "pending_timer",
                        "detectionExplanation": (
                            f"Experimental warning: Tracked person #{tid} held wrist near chest region for >=1.8s. "
                            "Pre-collapse indicator only; never diagnoses a cardiac or medical condition."
                        ),
                    }
                )

            person_states.append(
                {
                    "trackId": tid,
                    "x1": x1,
                    "y1": y1,
                    "cx": cx,
                    "cy": cy,
                    "bh": bh,
                    "bodySpeed": body_speed,
                    **pose,
                }
            )
            boxes_out.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "trackId": tid})

            color = (168, 70, 217) if not is_fallen else (0, 165, 255)
            cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
            cv2.putText(
                annotated,
                f"Person #{tid}",
                (int(x1), max(16, int(y1) - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (248, 245, 250),
                1,
                cv2.LINE_AA,
            )

        # Reset collapse overlay if no person currently in fallen timer
        if not any(
            t.fallen_since is not None and not t.collapse_alerted
            for t in self.tracks.values()
        ):
            self.active_collapse_timer = {
                "active": False,
                "trackId": None,
                "elapsedSeconds": 0.0,
                "remainingSeconds": collapse_req,
                "requiredSeconds": collapse_req,
            }

        # Evaluate pairwise interactions (chain snatching, slap, physical aggression, harassment)
        if len(person_states) >= 2:
            for a_idx in range(len(person_states)):
                for b_idx in range(a_idx + 1, len(person_states)):
                    self._evaluate_pair_interaction(
                        person_states[a_idx],
                        person_states[b_idx],
                        now,
                        agg_thresh,
                        annotated,
                        events,
                    )

        # Prune stale tracks/pairs unseen for > 5 seconds to prevent unbounded growth
        stale_tids = [tid for tid, t in self.tracks.items() if (now - t.last_seen) > 5.0]
        for tid in stale_tids:
            del self.tracks[tid]
        stale_pairs = [k for k, p in self.pairs.items() if (now - p.last_seen) > 5.0]
        for k in stale_pairs:
            del self.pairs[k]

        self.aggression_streak = max((p.aggression_streak for p in self.pairs.values()), default=0)

        label = (
            events[0]["incidentType"].replace("_", " ").title()
            if events
            else f"Tracking {len(person_states)} person(s)"
        )
        snapshot = SanitizedFrameSnapshot(
            timestamp=now,
            width=w_img,
            height=h_img,
            boxes=boxes_out,
            keypoints_list=keypoints_out,
            label=label,
        )
        return annotated, snapshot, events
