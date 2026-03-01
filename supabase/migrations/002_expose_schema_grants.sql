-- Required for REST/Realtime API to access apptest_prodplanner (avoids 406).
-- Run this after 001_initial.sql. Then add schema to "Exposed schemas" in Dashboard → Settings → API.
GRANT USAGE ON SCHEMA apptest_prodplanner TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA apptest_prodplanner TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA apptest_prodplanner TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA apptest_prodplanner GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA apptest_prodplanner GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
