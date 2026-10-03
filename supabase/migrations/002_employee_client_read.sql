-- Phase 3: let employees read the client rows linked to their assigned requests
-- (minimal fields are selected in code; row-level grant keeps RLS simple for v1).
drop policy if exists p_profiles_emp_client on profiles;
create policy p_profiles_emp_client on profiles for select using (
  public.current_role_() = 'employee' and exists (
    select 1 from requests r
    where r.client_id = profiles.id and r.assigned_to = auth.uid()
  )
);
