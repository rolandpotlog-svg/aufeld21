-- Explizite Alt-Freigaben entfernen, die bei älteren Supabase-Projekten
-- zusätzlich zur PUBLIC-Berechtigung vorhanden sein können.

revoke all on function public.next_invoice_number(integer) from anon;
revoke all on function public.finalize_invoice(uuid) from anon;
