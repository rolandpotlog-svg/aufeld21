-- SECURITY DEFINER-Funktionen dürfen niemals anonym über die Data API laufen.
-- Triggerfunktionen brauchen zusätzlich keinen direkten RPC-Zugriff.

revoke all on function public.cancel_invoice(uuid) from anon;
revoke all on function public.enforce_employee_booking_quota() from anon, authenticated;
revoke all on function public.finalize_invoice(uuid) from anon;
revoke all on function public.is_admin() from anon;
revoke all on function public.is_billing_member() from anon;
revoke all on function public.is_member() from anon;
revoke all on function public.is_tenant() from anon;
revoke all on function public.mark_invoice_paid(uuid, date) from anon;
revoke all on function public.next_invoice_number(integer) from anon;
revoke all on function public.rls_auto_enable() from anon, authenticated;
revoke all on function public.undo_invoice_payment(uuid) from anon;
