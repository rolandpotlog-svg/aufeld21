-- The new pg_net installation has not sent any requests yet. Correct only its
-- extension metadata namespace; its actual objects remain in the private-to-API
-- net schema. No CASCADE, no application or financial records are removed.
select pg_advisory_xact_lock(21021,709);
do $$ begin
  if (select enabled from public.email_notification_settings where id)
    or exists(select 1 from net.http_request_queue)
    or exists(select 1 from net._http_response)
    or exists(select 1 from public.email_notifications) then
    raise exception 'Namespace correction requires a paused, unused notification setup';
  end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
