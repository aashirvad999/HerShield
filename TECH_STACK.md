# HerShield Tech Stack

HerShield is a privacy-first AI safety monitoring and community volunteer dispatch platform composed of a **Next.js** web application and a **FastAPI** computer-vision microservice.

---

## 1. Frontend & Web Application
- **Framework:** Next.js `16.4.6` (App Router with Turbopack)
- **UI Library:** React `19.3.0`, React DOM `19.3.0`
- **Language:** TypeScript `^5`
- **Styling:** Tailwind CSS `4.3.3` (`@tailwindcss/turbopack`) with a custom Light & Pink theme
- **Icons:** Lucide React `^1.82.0`
- **Linting:** ESLint `^9` (`eslint-config-next`)

---

## 2. Backend, Auth & Database (Next.js API Routes)
- **API Layer:** Next.js Route Handlers (`src/app/api/**`), including a streaming AI proxy (`/api/ai-proxy/[...path]`)
- **Database:** MongoDB Atlas (`mongodb` `^7.9.1`) with `2dsphere` geospatial indexing for nearby volunteer matching, plus an automatic local JSON/in-memory fallback store (`.hershield-local-store.json`)
- **Authentication & Security:**
  - `jose` (`^6.2.18`) for HS256 JWT session cookies (`hershield_session`)
  - `bcryptjs` (`^3.0.3`) for password hashing
  - Environment-configurable login bypass (`DISABLE_LOGIN` in `.env.local`) for local development
  - Shared-secret header (`x-hershield-ai-secret`) between Next.js and the AI service
- **Notifications & Alerting:**
  - Telegram Bot API (server-side HTML alerts, webhook/polling updates, and volunteer linking)
  - Per-incident deduplication and 60-second minimum per-volunteer notification cooldown (`src/lib/dispatch.ts`)

---

## 3. AI & Computer Vision Microservice (`ai-service/`)
- **Runtime:** Python `3.12` (`.venv`)
- **API & Streaming Server:**
  - FastAPI (`>=0.115.0`)
  - Uvicorn (`>=0.30.0`)
  - Pydantic (`>=2.9.0`), `python-multipart` (`>=0.0.9`), `websockets` (`>=13.0`), `httpx` (`>=0.27.2`), `python-dotenv` (`>=1.0.1`)
- **Pose Estimation & Tracking:**
  - Ultralytics (`>=8.3.0`) with **YOLO11n-Pose** (`yolo11n-pose.pt`)
  - **ByteTrack** multi-object tracking (`lapx >=0.5.9`) with stable 1-indexed `DisplayIdManager`
  - **CUDA** GPU acceleration (PyTorch / NVIDIA GPU) with automatic CPU fallback
- **Video Processing & Privacy:**
  - OpenCV (`opencv-python >=4.10.0`) & NumPy
  - `FreshFrameReader` background thread for low-latency live webcam/RTSP/MJPEG ingestion
  - Face-blurred volunteer video preview export (`WebM / VP80` with `mp4v` fallback) and SHA-256 integrity hashing (`privacy_shield.py`)
  - Palm-cover camera blackout toggle to pause/re-enable detection

---

## 4. Local Runner, Tunneling & Deployment
- **Local Orchestration:** PowerShell (`start-hershield.ps1`) & Windows Batch (`start-hershield.bat`)
- **Remote Tunneling (Optional):** Cloudflare Tunnel (`cloudflared` quick tunnel via `-WithTunnel`)
- **Hosting Target:** Vercel (`vercel.json`) for the Next.js app + local/edge GPU node for `ai-service`
