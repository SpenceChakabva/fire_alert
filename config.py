import os
import json
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# -----------------------------
# EUMETSAT
# -----------------------------
EUMETSAT_CONSUMER_KEY = os.getenv("EUMETSAT_CONSUMER_KEY", "")
EUMETSAT_CONSUMER_SECRET = os.getenv("EUMETSAT_CONSUMER_SECRET", "")
EUM_COLLECTION = os.getenv("EUM_COLLECTION", "EO:EUM:DAT:0682")

# -----------------------------
# NASA FIRMS
# -----------------------------
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "")

# -----------------------------
# Paths
# -----------------------------
AOI_FILE = os.path.join(BASE_DIR, "src", "aoi.geojson")
DB_FILE = os.path.join(BASE_DIR, "src", "alerts.db")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# -----------------------------
# Thresholds & Dynamic Settings
# -----------------------------
SETTINGS_FILE = os.path.join(BASE_DIR, "settings.json")

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "MIN_CONFIDENCE": float(os.getenv("MIN_CONFIDENCE", "0.5")),
        "LOOKBACK_HOURS": int(os.getenv("LOOKBACK_HOURS", "2")),
        "POLL_INTERVAL_SECONDS": int(os.getenv("POLL_INTERVAL_SECONDS", "900"))
    }

def save_settings(new_settings):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(new_settings, f, indent=2)

_current_settings = load_settings()
MIN_CONFIDENCE = float(_current_settings.get("MIN_CONFIDENCE", 0.5))
LOOKBACK_HOURS = int(_current_settings.get("LOOKBACK_HOURS", 2))
POLL_INTERVAL_SECONDS = int(_current_settings.get("POLL_INTERVAL_SECONDS", 900))

# -----------------------------
# Telerivet & Alerts
# -----------------------------
TEST_MODE = os.getenv("TEST_MODE", "True").lower() in ("true", "1", "yes")
TELERIVET_API_KEY = os.getenv("TELERIVET_API_KEY", "")
TELERIVET_PROJECT_ID = os.getenv("TELERIVET_PROJECT_ID", "")
TELERIVET_GROUP_ID = os.getenv("TELERIVET_GROUP_ID", "")
ALERT_TO = os.getenv("ALERT_TO", "")