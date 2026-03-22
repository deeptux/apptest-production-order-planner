# Supabase setup for NPB Loaf Line Production Planner

This app uses a **dedicated schema** `apptest_prodplanner`. The Supabase REST API only exposes `public` by default, so you must **expose this schema** or plan/override requests will return **406** and real-time sync between clients will not work.

1. Create or use an existing project at [supabase.com](https://supabase.com).
2. In SQL Editor, run the migrations in order (copy the file contents, not the path):
   - **001_initial.sql** — creates schema `apptest_prodplanner` and tables `plan`, `override_requests`.
   - **Supervisor → admin requests:** No extra migration is required. The `override_requests` table already stores `station_id`, `requested_by`, `payload` (JSON — includes request type, line/process, note, `supervisorClientId`, row id, etc.), and `status` (`pending` / `approved` / `rejected`). New fields are added in `payload`, not as new columns.
   - **002_expose_schema_grants.sql** — grants so `anon`/`authenticated`/`service_role` can use the schema (required for API access).
   - **003_override_requests_delete_policy.sql** — optional but recommended: lets supervisors **withdraw** (delete) pending requests from the UI when using Supabase.
3. **Expose the schema (required for real-time sync):** In Dashboard go to **Project Settings → API**. Find **“Exposed schemas”** and add **`apptest_prodplanner`** to the list. Save. Without this, `getPlan`/`updatePlan` and override APIs return 406 and the other browser client will never receive updates.
4. **Realtime publication (not “Platform → Replication”):** The left sidebar item **Database → Replication** under **PLATFORM** is only for read replicas / external pipelines — that is **not** where you enable Realtime tables.
   - **Option A — Dashboard:** In the left sidebar under **DATABASE MANAGEMENT**, open **Publications**. Select the **`supabase_realtime`** publication and add these tables (schema **`apptest_prodplanner`**): **`plan`**, **`override_requests`**, **`config`**. Save.
   - **Option B — SQL Editor:** Run (repeat only for tables not already in the publication; skip lines that error with “already member”):

```sql
alter publication supabase_realtime add table apptest_prodplanner.plan;
alter publication supabase_realtime add table apptest_prodplanner.override_requests;
alter publication supabase_realtime add table apptest_prodplanner.config;
```

   Without **`config`**, recipes and production lines do not live-sync across browsers (plan and overrides still can).
5. In **Settings → API**: copy **Project URL** and **anon public** key into your app `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Optional:** To use a different schema name, set `VITE_SUPABASE_SCHEMA=your_schema` and create that schema/tables with the same structure, then expose that schema and grant the same privileges.

To seed an initial plan row (optional), run:

```sql
insert into apptest_prodplanner.plan (plan_date, rows) values (
  (current_date + interval '1 day')::timestamptz,
  '[{"id":"1","product":"Everyday Bread 8s","soQty":2572,"theorOutput":728,"capacity":2340,"procTime":502,"startSponge":"22:00","endDough":"02:42","endBatch":"06:22","batch":"1st"},{"id":"2","product":"Everyday Bread 12s","soQty":2173,"theorOutput":1092,"capacity":1575,"procTime":507,"startSponge":"02:50","endDough":"07:32","endBatch":"11:17","batch":"1st"},{"id":"3","product":"Whole Wheat 8s","soQty":1090,"theorOutput":536,"capacity":2340,"procTime":517,"startSponge":"07:40","endDough":"12:27","endBatch":"16:17","batch":"1st"},{"id":"4","product":"Raisin 8s","soQty":500,"theorOutput":687,"capacity":2340,"procTime":555,"startSponge":"12:30","endDough":"17:32","endBatch":"22:05","batch":"1st"}]'::jsonb
);
```

If no row exists, the app falls back to localStorage/mock data.
