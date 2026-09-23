-- Register the studio admin account.
--
-- 1. Create the login first: Dashboard → Authentication → Users → Add user.
--    Tick "Auto Confirm User". This project has email confirmation switched on, so
--    without it admin.html login fails with "Email not confirmed".
-- 2. Copy the new user's UUID and paste it over the placeholder below.
-- 3. Run the INSERT in the SQL editor. (Equivalent via PostgREST with the secret key:
--    POST /rest/v1/admin_users with body {"user_id":"<uuid>"}.)
--
-- Access model: admin_users is readable only by its own row, and every product write
-- policy checks public.is_admin(). Deleting this row revokes admin access immediately.

-- INSERT INTO public.admin_users (user_id)
-- VALUES ('00000000-0000-0000-0000-000000000000');

