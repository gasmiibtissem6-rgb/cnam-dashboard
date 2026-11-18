-- DevSecOps: prevent client-side insertion into system-managed tables

DROP POLICY IF EXISTS "System can insert security events"
ON public.security_events;

DROP POLICY IF EXISTS "System can insert email logs"
ON public.email_logs;

DROP POLICY IF EXISTS "System can insert blocked IPs"
ON public.blocked_ips;

DROP POLICY IF EXISTS "System can insert login history"
ON public.user_login_history;
