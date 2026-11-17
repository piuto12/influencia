-- 0013: trigger functions are never callable through the API.
revoke all on function log_registration_status() from public, anon, authenticated;
