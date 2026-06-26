"""
Database operations for fire alert tracking.
Handles SQLite storage of sent alerts and system messages.
"""

import sqlite3
from datetime import datetime, timezone, timedelta

from config import DB_FILE


def init_db():
    """Create core alert tables if they don't exist."""
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sent_alerts (
            alert_id TEXT PRIMARY KEY,
            event_time TEXT,
            latitude REAL,
            longitude REAL,
            confidence REAL,
            field_name TEXT,
            risk_level TEXT,
            source TEXT,
            created_at TEXT
        )
    """)
    # Migrate: add risk_level and source columns if missing
    try:
        cur.execute("ALTER TABLE sent_alerts ADD COLUMN risk_level TEXT")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE sent_alerts ADD COLUMN source TEXT")
    except Exception:
        pass
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sent_forester_alerts (
            alert_id TEXT PRIMARY KEY,
            created_at TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS system_messages (
            message_type TEXT PRIMARY KEY,
            last_sent_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def already_sent(alert_id: str) -> bool:
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM sent_alerts WHERE alert_id = ?", (alert_id,))
    row = cur.fetchone()
    conn.close()
    return row is not None


def mark_sent(alert_id, event_time, latitude, longitude, confidence, field_name, risk_level=None, source=None):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO sent_alerts
        (alert_id, event_time, latitude, longitude, confidence, field_name, risk_level, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        alert_id, event_time, latitude, longitude, confidence,
        field_name, risk_level, source,
        datetime.now(timezone.utc).isoformat()
    ))
    conn.commit()
    conn.close()


def forester_already_sent(alert_id: str) -> bool:
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM sent_forester_alerts WHERE alert_id = ?", (alert_id,))
    row = cur.fetchone()
    conn.close()
    return row is not None


def forester_mark_sent(alert_id: str):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR IGNORE INTO sent_forester_alerts (alert_id, created_at)
        VALUES (?, ?)
    """, (alert_id, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    conn.close()


def get_last_system_message_time(message_type: str):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT last_sent_at FROM system_messages WHERE message_type = ?", (message_type,))
    row = cur.fetchone()
    conn.close()
    if row and row[0]:
        try:
            return datetime.fromisoformat(row[0])
        except Exception:
            return None
    return None


def update_last_system_message_time(message_type: str):
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO system_messages (message_type, last_sent_at)
        VALUES (?, ?)
        ON CONFLICT(message_type) DO UPDATE SET last_sent_at=excluded.last_sent_at
    """, (message_type, now_iso))
    conn.commit()
    conn.close()


def should_send_no_fire_message(heartbeat_hours: int = 3) -> bool:
    last_sent = get_last_system_message_time("no_fire")
    if last_sent is None:
        return True
    now = datetime.now(timezone.utc)
    return (now - last_sent) >= timedelta(hours=heartbeat_hours)


def get_all_alerts(limit: int = 500, date_from: str = None, date_to: str = None, risk_level: str = None):
    """Retrieve alerts with optional filters."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    conditions = []
    params = []
    if date_from:
        conditions.append("created_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("created_at <= ?")
        params.append(date_to)
    if risk_level and risk_level.lower() != "all":
        conditions.append("LOWER(risk_level) = ?")
        params.append(risk_level.lower())

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    cur.execute(f"""
        SELECT alert_id, event_time, latitude, longitude, confidence,
               field_name, risk_level, source, created_at
        FROM sent_alerts
        {where}
        ORDER BY created_at DESC
        LIMIT ?
    """, params)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def get_system_messages(limit: int = 50):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT message_type, last_sent_at
        FROM system_messages
        ORDER BY last_sent_at DESC
        LIMIT ?
    """, (limit,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def get_alert_stats_by_date():
    """Return daily counts for chart visualisation."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT DATE(created_at) as date,
               COUNT(*) as total,
               SUM(CASE WHEN LOWER(risk_level)='high'   THEN 1 ELSE 0 END) as high,
               SUM(CASE WHEN LOWER(risk_level)='medium' THEN 1 ELSE 0 END) as medium,
               SUM(CASE WHEN LOWER(risk_level)='low'    THEN 1 ELSE 0 END) as low
        FROM sent_alerts
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows
