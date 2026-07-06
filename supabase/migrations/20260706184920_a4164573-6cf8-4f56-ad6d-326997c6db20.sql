
-- Transfers: restrict UPDATE to owner/admin/manager and block edits to confirmed rows
DROP POLICY IF EXISTS "Members can update transfers" ON public.transfers;
CREATE POLICY "Managers can update non-confirmed transfers"
ON public.transfers FOR UPDATE
USING (
  has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role])
  AND is_confirmed = false
)
WITH CHECK (
  has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role])
);

-- user_credit_profiles: only own row
DROP POLICY IF EXISTS "Members view org credit profiles" ON public.user_credit_profiles;
CREATE POLICY "Users view own credit profile"
ON public.user_credit_profiles FOR SELECT
USING (user_id = auth.uid());

-- whatsapp_connections: restrict SELECT to owner/admin (tokens/verification codes)
DROP POLICY IF EXISTS "Users can view their organization whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Admins view whatsapp connections"
ON public.whatsapp_connections FOR SELECT
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- financial_milestones: only own
DROP POLICY IF EXISTS "Members view org milestones" ON public.financial_milestones;
CREATE POLICY "Users view own milestones"
ON public.financial_milestones FOR SELECT
USING (user_id = auth.uid());

-- salary_payments: only owner/admin/manager
DROP POLICY IF EXISTS "Members can view salary payments" ON public.salary_payments;
CREATE POLICY "Managers can view salary payments"
ON public.salary_payments FOR SELECT
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));
