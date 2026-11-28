import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

AI_SERVICE_SECRET = os.getenv("AI_SERVICE_SECRET", "hershield-local-ai-secret").strip()
APP_BACKEND_URL = os.getenv("APP_BACKEND_URL", "http://127.0.0.1:3000").strip().rstrip("/")
MODEL_DEVICE = os.getenv("MODEL_DEVICE", "auto").strip().lower()
MODEL_CONFIDENCE_THRESHOLD = float(os.getenv("MODEL_CONFIDENCE_THRESHOLD", "0.40"))
CAMERA_SOURCE = os.getenv("CAMERA_SOURCE", "0").strip()
INFERENCE_SIZE = int(os.getenv("INFERENCE_SIZE", "640"))
INFERENCE_FPS_TARGET = float(os.getenv("INFERENCE_FPS_TARGET", "15"))

PRIVACY_BUFFER_PRE_SECONDS = float(os.getenv("PRIVACY_BUFFER_PRE_SECONDS", "4.0"))
PRIVACY_BUFFER_POST_SECONDS = float(os.getenv("PRIVACY_BUFFER_POST_SECONDS", "3.0"))

COLLAPSE_CONFIRM_SECONDS = float(os.getenv("COLLAPSE_CONFIRM_SECONDS", "5.0"))
AGGRESSION_CONFIDENCE_THRESHOLD = float(os.getenv("AGGRESSION_CONFIDENCE_THRESHOLD", "0.58"))

AI_HOST = os.getenv("AI_HOST", "127.0.0.1").strip()
AI_PORT = int(os.getenv("AI_PORT", "8000"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]

STORAGE_DIR = BASE_DIR / "storage"
PREVIEWS_DIR = STORAGE_DIR / "previews"
UPLOADS_DIR = STORAGE_DIR / "uploads"
SAMPLES_DIR = BASE_DIR / "samples"

for d in (STORAGE_DIR, PREVIEWS_DIR, UPLOADS_DIR, SAMPLES_DIR):
    d.mkdir(parents=True, exist_ok=True)
