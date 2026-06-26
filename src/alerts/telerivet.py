"""
Telerivet SMS delivery module.
Handles sending fire alerts and system heartbeat messages via Telerivet API.
"""

import os
from datetime import datetime, timezone

import pandas as pd
import requests

from config import OUTPUT_DIR
from src.core.database import (
    forester_already_sent,
    forester_mark_sent,
    should_send_no_fire_message,
    update_last_system_message_time
)

ALERTS_FILE = os.path.join(OUTPUT_DIR, "ranked_fire_alerts.csv")


def build_alert_id(row):
    """Generate a unique ID for an alert to prevent duplicates."""
    return (
        f"{row.get('source', 'NA')}_"
        f"{row.get('nearest_cpt', 'NA')}_"
        f"{row.get('distance_km', 'NA')}_"
        f"{row.get('latitude', 'NA')}_"
        f"{row.get('longitude', 'NA')}"
    )


def format_fire_message(row):
    """Format the SMS text for a fire alert."""
    confidence_part = ""
    if "confidence" in row and pd.notna(row["confidence"]):
        try:
            confidence_part = f"\nConfidence: {float(row['confidence']):.2f}"
        except Exception:
            confidence_part = ""

    return (
        f"{str(row['risk_level']).upper()} RISK FIRE ALERT\n"
        f"Source: {row.get('source', 'Unknown')}\n"
        f"Nearest CPT: {row.get('nearest_cpt', 'Unknown')}\n"
        f"Distance: {row.get('distance_km', 'NA')} km\n"
        f"Lat,Lon: {row.get('latitude', 'NA')}, {row.get('longitude', 'NA')}"
        f"{confidence_part}\n"
        f"Action: Check immediately"
    )


def format_no_fire_message():
    """Format the heartbeat SMS when no fires are detected."""
    return (
        "SAA Fire Monitoring Update\n"
        "Status: No fire detected near monitored compartments\n"
        f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n"
        "Source: Meteosat + VIIRS\n"
        "System: Operational"
    )


def send_to_telerivet_group(message_text: str):
    """Send an SMS broadcast to the configured Telerivet group."""
    TELERIVET_API_KEY = os.environ.get("TELERIVET_API_KEY", "")
    TELERIVET_PROJECT_ID = os.environ.get("TELERIVET_PROJECT_ID", "")
    TELERIVET_GROUP_ID = os.environ.get("TELERIVET_GROUP_ID", "")
    url = f"https://api.telerivet.com/v1/projects/{TELERIVET_PROJECT_ID}/send_broadcast"
    response = requests.post(
        url,
        auth=(TELERIVET_API_KEY, ""),
        json={
            "content": message_text,
            "group_id": TELERIVET_GROUP_ID,
            "message_type": "sms"
        },
        timeout=30
    )

    if not response.ok:
        print("Status code:", response.status_code)
        print("Response text:", response.text)
        response.raise_for_status()

    return response.json()


def send_message(message_text: str):
    """Send a message via Telerivet and log success, or just print in test mode."""
    from config import TEST_MODE
    
    if TEST_MODE:
        print("\n" + "="*50)
        print("🛠️ TEST MODE: SMS WOULD HAVE BEEN SENT")
        print("="*50)
        print(message_text)
        print("="*50 + "\n")
        return {"status": "mocked", "message": "Simulated in test mode"}

    result = send_to_telerivet_group(message_text)
    print("Message sent successfully:")
    print(result)
    print("-" * 70)


def process_forester_alerts():
    """Main workflow to read the ranked alerts and send SMS notifications."""
    TELERIVET_API_KEY = os.environ.get("TELERIVET_API_KEY", "")
    TELERIVET_PROJECT_ID = os.environ.get("TELERIVET_PROJECT_ID", "")
    TELERIVET_GROUP_ID = os.environ.get("TELERIVET_GROUP_ID", "")
    if not TELERIVET_API_KEY or not TELERIVET_PROJECT_ID or not TELERIVET_GROUP_ID:
        print("Warning: Telerivet API settings missing in .env. Skipping SMS.")
        return

    def send_heartbeat_if_needed():
        if should_send_no_fire_message():
            no_fire_message = format_no_fire_message()
            try:
                send_message(no_fire_message)
                update_last_system_message_time("no_fire")
            except Exception as e:
                print(f"Failed sending no-fire message: {e}")
        else:
            print("No-fire heartbeat not due yet.")

    if not os.path.exists(ALERTS_FILE):
        print(f"{ALERTS_FILE} not found.")
        send_heartbeat_if_needed()
        return

    alerts = pd.read_csv(ALERTS_FILE)

    if alerts.empty:
        print(f"{ALERTS_FILE} is empty.")
        send_heartbeat_if_needed()
        return

    # Filter for High and Medium risk only
    alerts = alerts[
        alerts["risk_level"].astype(str).str.lower().isin(["high", "medium"])
    ].copy()

    if not alerts.empty:
        sent_any = False

        for _, row in alerts.iterrows():
            alert_id = build_alert_id(row)

            if forester_already_sent(alert_id):
                continue

            message_text = format_fire_message(row)

            try:
                send_message(message_text)
                forester_mark_sent(alert_id)
                sent_any = True
            except Exception as e:
                print(f"Failed sending fire alert: {e}")

        if not sent_any:
            print("No new fire alerts to send.")

    else:
        print("No High or Medium fire alerts found.")
        send_heartbeat_if_needed()
