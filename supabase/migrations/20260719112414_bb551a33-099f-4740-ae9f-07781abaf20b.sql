
-- 1) Fix mutable search_path on ledger_block_mutation
ALTER FUNCTION public.ledger_block_mutation() SET search_path = public;

-- 2) Revoke EXECUTE on all SECURITY DEFINER functions in public from PUBLIC and anon
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 3) Scope realtime.messages policies to org- or user-owned topics
DROP POLICY IF EXISTS "Authenticated users can receive broadcasts" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send broadcasts"    ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can read messages"      ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages"    ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can select"                   ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can insert"                   ON realtime.messages;

-- Allow subscribe/read only when topic is of the form "org:<uuid>" for an org
-- the user belongs to, or "user:<auth.uid()>" for their own channel.
CREATE POLICY "Scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    realtime.topic() LIKE 'org:%'
    AND public.is_organization_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR realtime.topic() = 'user:' || auth.uid()::text
);

CREATE POLICY "Scoped realtime write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (
    realtime.topic() LIKE 'org:%'
    AND public.is_organization_member(
      auth.uid(),
      NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
    )
  )
  OR realtime.topic() = 'user:' || auth.uid()::text
);
