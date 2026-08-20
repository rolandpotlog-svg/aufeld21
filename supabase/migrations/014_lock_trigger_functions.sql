-- Triggerfunktionen werden von Postgres selbst ausgeführt und brauchen keinen
-- direkten Zugriff über PostgREST/RPC.

revoke all on function public.enforce_employee_booking_quota() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
