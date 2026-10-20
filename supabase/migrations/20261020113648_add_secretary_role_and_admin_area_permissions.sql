-- Ajouter un rôle métier distinct pour le secrétariat.
ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_role_check;
ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_role_check
  CHECK (role IN ('admin','reception','member','secretary'));

DROP POLICY IF EXISTS staff_read_self_reception_admin ON public.staff_members;
CREATE POLICY staff_read_self_reception_admin ON public.staff_members
FOR SELECT TO authenticated
USING (
  id = (select auth.uid())
  OR private.has_role(ARRAY['admin','reception','secretary']::text[])
);

DROP POLICY IF EXISTS floors_admin_write ON public.floors;
CREATE POLICY floors_admin_write ON public.floors
FOR ALL TO authenticated
USING (private.has_role(ARRAY['admin','secretary']::text[]))
WITH CHECK (private.has_role(ARRAY['admin','secretary']::text[]));

DROP POLICY IF EXISTS reasons_admin_write ON public.visit_reasons;
CREATE POLICY reasons_admin_write ON public.visit_reasons
FOR ALL TO authenticated
USING (private.has_role(ARRAY['admin','secretary']::text[]))
WITH CHECK (private.has_role(ARRAY['admin','secretary']::text[]));

DROP POLICY IF EXISTS staff_admin_update ON public.staff_members;
CREATE POLICY staff_admin_update ON public.staff_members
FOR UPDATE TO authenticated
USING (private.has_role(ARRAY['admin']::text[]))
WITH CHECK (private.has_role(ARRAY['admin']::text[]));

DROP POLICY IF EXISTS staff_secretary_update ON public.staff_members;
CREATE POLICY staff_secretary_update ON public.staff_members
FOR UPDATE TO authenticated
USING (
  private.has_role(ARRAY['secretary']::text[])
  AND id <> (select auth.uid())
  AND role <> 'admin'
)
WITH CHECK (
  private.has_role(ARRAY['secretary']::text[])
  AND id <> (select auth.uid())
  AND role <> 'admin'
);

REVOKE UPDATE ON public.staff_members FROM authenticated;
GRANT UPDATE (role) ON public.staff_members TO authenticated;
GRANT UPDATE (floor_id, delegate_member_id, is_active, updated_at) ON public.staff_members TO authenticated;
