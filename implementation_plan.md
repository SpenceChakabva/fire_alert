# Zimbabwe Fire Alerts — UI & Features Implementation Plan

This plan covers updating the UI to focus specifically on Zimbabwe, adding organic and professional styling, implementing manual controls/settings, and adding database history views. We will ensure the core logic from `final_fire_monitoring_demo.py` is strictly maintained.

## User Review Required

> [!IMPORTANT]  
> **Settings Management:** Currently, settings like `MIN_CONFIDENCE` and `LOOKBACK_HOURS` are in the `.env` file. To allow the UI to modify them dynamically without restarting the server, I propose moving these specific operational settings to a new `settings.json` file or a dedicated SQLite table, while keeping API keys securely in `.env`.

> [!TIP]
> **Organic Styling:** I will pivot away from the "glowy/neon" tech look and move toward a professional GIS aesthetic. Think earthy dark greens, warm amber accents for fires, clean sans-serif typography, and subtle glassmorphism.

## Open Questions

1. **Past Fire Patterns:** Should the map display historical fires (e.g., from the past week) as a heatmap overlay, or is a tabular history view of past alerts sufficient?
2. **Manual Checks:** When the user clicks "Run Manual Check" in the UI, it will take ~30-60 seconds to download and process EUMETSAT data. Is a simple loading spinner acceptable for this wait?

---

## Proposed Changes

### 1. Core Logic Verification
- I will verify that `final_fire_monitoring_demo.py`'s exact logic is preserved in the pipeline. Specifically, the bounding box for Zimbabwe `(lon >= 25 & lon <= 34 & lat >= -23 & lat <= -15)` will be the primary focus for the UI.

### 2. Backend API Updates
#### [MODIFY] `src/api/server.py`
- Add endpoints for Zimbabwe GeoJSON:
  - `GET /api/geojson/zim/viirs`
  - `GET /api/geojson/zim/mtg`
- Add history endpoints:
  - `GET /api/history/alerts` (Fetches past alerts from SQLite `sent_alerts` table)
  - `GET /api/history/logs` (Fetches system messages)
- Implement configuration endpoints:
  - `GET /api/settings`
  - `POST /api/settings`
- Fully implement `POST /api/pipeline/run` to actually trigger the `run_pipeline()` function asynchronously and return status.

#### [MODIFY] `src/core/database.py`
- Add functions to query historical alerts with date filters.
- Add functions to query system logs.

### 3. Frontend UI Redesign & New Features

#### Styling & Layout
- **Organic Theme:** Update `tailwind.config.js` and `globals.css` with a new color palette (Slate, Forest Green, Amber/Rust for fires).
- **Navigation:** Add a left sidebar with tabs: Dashboard (Map), Database (History), Settings.

#### [MODIFY] `ui/src/app/page.tsx` & `ui/src/components/FireMap.tsx`
- **Zimbabwe Focus:** Adjust Leaflet map default center to `[-19.0154, 29.1549]` (Zimbabwe) with zoom level `7`.
- **Map Layers:** Default to serving `viirs_zimbabwe.geojson` and `mtg_zimbabwe.geojson`.
- **Manual Trigger:** Add a prominent "Run Manual Check" button with a loading state that calls `POST /api/pipeline/run`.

#### [NEW] `ui/src/app/history/page.tsx`
- A dedicated Database View.
- Shows a data table of all historical alerts fetched from the SQLite database.
- Includes pagination and sorting by date/risk level.
- Heatmap toggle: Button to visualize these historical points on a mini-map to identify past fire patterns.

#### [NEW] `ui/src/app/settings/page.tsx`
- Form interface to adjust:
  - Minimum Confidence Threshold (e.g., 0.5)
  - Lookback Hours (e.g., 2)
  - Polling Interval (e.g., 900s)
- Saves back to the backend via `POST /api/settings`.

---

## Verification Plan

### Automated Tests
- Test backend endpoints via `curl` or python `requests` to ensure historical data is returned correctly.
- Verify `settings.json` is updated when the POST endpoint is hit.

### Manual Verification
- **Map Focus:** Open the UI and confirm the map tightly frames Zimbabwe and only shows relevant Zim alerts.
- **Manual Check:** Click "Run Manual Check" and verify the backend logs show the pipeline running, and the UI updates when finished.
- **History View:** Navigate to the History tab and confirm data from `alerts.db` is displayed in the table.
- **Styling:** Ensure the aesthetic feels natural, professional, and less "AI".
