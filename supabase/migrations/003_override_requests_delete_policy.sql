-- Allow DELETE on override_requests so supervisors can withdraw pending rows from the app.
-- Without this, deleteOverride() returns an RLS error.
create policy "Allow public delete override_requests"
  on apptest_prodplanner.override_requests for delete
  using (true);
