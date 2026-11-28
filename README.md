# HerShield — Privacy-First AI & Community Women's Safety Platform

HerShield is a **Gov-Independent CivicTech** prototype that runs local computer vision (YOLO11n-Pose + ByteTrack) on the operator's laptop, converts detected events into non-identifying **PrivacyShield** skeletal previews, and dispatches verified nearby community volunteers via **MongoDB Atlas 2dsphere** geospatial queries and **Telegram Bot API**.

> **Important Disclaimer:** HerShield complements official emergency services (e.g., dial **112**) and never claims to replace them. Heuristic confidence scores are experimental indicators, not proof of a crime or medical diagnosis. Verification records in this prototype use demonstration placeholders and do not represent real criminal background checks.

---

## Architecture

- **Frontend & API (`Next.js 16 App Router`, TypeScript, Tailwind CSS)** — Deployed to **Vercel** (or run locally).
- **Database (`MongoDB Atlas`)** — Serverless pooled `mongodb` driver with GeoJSON `2dsphere` index on `volunteers.registeredLocation`. Falls back transparently to an in-memory demo dataset if `MONGODB_URI` is unconfigured or unreachable.
- **Local AI Service (`ai-service/`, Python 3.12, FastAPI, OpenCV, Ultralytics YOLO11n-Pose, ByteTrack, PyTorch)** — Runs locally on your laptop (RTX 3050 6GB CUDA with automatic CPU fallback). Raw video never leaves the laptop.
- **Notifications (`Telegram Bot API`)** — Server-side only dispatch using `TELEGRAM_BOT_TOKEN` with authenticated volunteer deep links.

---

## Quick Start (Local Demonstration Mode)

### 1. Frontend & API (Next.js)

```bash
cp .env.example .env.local
# Edit .env.local with your MONGODB_URI, AUTH_SECRET, and optional TELEGRAM_BOT_TOKEN
npm install
npm run dev
```

Open `http://localhost:3000`.

### 2. Local Python AI Service

```powershell
cd ai-service
copy .env.example .env
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

> **Note:** On first run, Ultralytics downloads `yolo11n-pose.pt` (~6 MB).

---

## Environment Variables Split (Vercel vs Laptop)

### Vercel Project Environment Variables (Frontend & Serverless API)
| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas SRV connection string |
| `MONGODB_DB` | Database name (default: `hershield`) |
| `AUTH_SECRET` | Strong random 32+ char secret for HTTP-only JWT cookies |
| `AI_SERVICE_URL` | Tunnel URL pointing to laptop AI service (e.g., `https://your-tunnel.trycloudflare.com`) |
| `AI_SERVICE_SECRET` | Shared secret matching `ai-service/.env` |
| `TELEGRAM_BOT_TOKEN` | Server-only Telegram Bot API token (never `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_APP_URL` | Deployed Vercel URL (used in Telegram deep links) |

### Laptop `ai-service/.env` (Local AI Inference)
| Variable | Purpose |
| --- | --- |
| `AI_SERVICE_SECRET` | Shared secret matching Vercel `AI_SERVICE_SECRET` |
| `APP_BACKEND_URL` | `http://127.0.0.1:3000` (local) or your Vercel URL |
| `MODEL_DEVICE` | `auto` (uses RTX 3050 CUDA if available, else CPU) |
| `INFERENCE_SIZE` | `640` |
| `INFERENCE_FPS_TARGET` | `15` |
| `COLLAPSE_CONFIRM_SECONDS` | `5.0` |

### Exposing Local AI Service to Vercel via Secure Tunnel (Optional)
```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```
Set the resulting `https://*.trycloudflare.com` URL as `AI_SERVICE_URL` in Vercel. Local-only mode (`http://127.0.0.1:8000`) continues working without any tunnel.

---

## Demo Accounts (Pre-seeded)

| Role | Email | Password |
| --- | --- | --- |
| Operator | `operator@hershield.demo` | `HerShieldOp#2026` |
| Volunteer (Verified) | `ananya.demo@hershield.demo` | `HerShieldVol#2026` |
| Admin | `admin@hershield.demo` | `HerShieldAdmin#2026` |

---

## Supported Camera & Sample Inputs

1. **Laptop Webcam** (`OpenCV VideoCapture(0)`)
2. **Phone IP Camera** (`http://<PHONE_IP>:8080/video` MJPEG or `rtsp://...`)
3. **Uploaded Video** (`.mp4`, `.mov`, `.avi`, `.webm` — processed locally and removed after PrivacyShield preview extraction)
4. **Built-in Demo Scenarios** (Aggression, 5-Second Collapse Confirmation, Chain-Snatching Experimental, Vehicle/Pedestrian Experimental)
