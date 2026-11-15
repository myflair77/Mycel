-- Production scheduler, separate from the portable database test migration.
create extension if not exists pg_cron;
select cron.schedule('mycel-scheduled-messages','* * * * *','select public.run_scheduled_messages()');
