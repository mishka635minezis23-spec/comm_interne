REVOKE UPDATE ON TABLE public.staff_members FROM authenticated;
REVOKE UPDATE (role, is_active, floor_id, delegate_member_id, updated_at, availability, availability_until)
  ON TABLE public.staff_members FROM authenticated;

DROP POLICY IF EXISTS staff_secretary_update ON public.staff_members;

CREATE OR REPLACE FUNCTION public.admin_update_member(
  p_member_id uuid,
  p_role text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION 'Action réservée à un administrateur.';
  END IF;

  IF p_member_id IS NULL OR (p_role IS NULL AND p_is_active IS NULL) THEN
    RAISE EXCEPTION 'Aucune modification à appliquer.';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'secretary', 'reception', 'member') THEN
    RAISE EXCEPTION 'Rôle invalide.';
  END IF;

  IF p_member_id = (SELECT auth.uid()) AND p_role IS NOT NULL AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle administrateur.';
  END IF;

  IF p_member_id = (SELECT auth.uid()) AND p_is_active = false THEN
    RAISE EXCEPTION 'Vous ne pouvez pas désactiver votre propre compte.';
  END IF;

  UPDATE public.staff_members
  SET role = COALESCE(p_role, role),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = now()
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membre introuvable.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_member(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_member(uuid, text, boolean) TO authenticated;

INSERT INTO public.visit_reasons (label, is_active, sort_order)
SELECT seeds.label, true, seeds.sort_order
FROM (VALUES
  ('Rendez-vous', 10),
  ('Réunion', 20),
  ('Dépôt ou retrait de documents', 30),
  ('Livraison', 40),
  ('Autre', 99)
) AS seeds(label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.visit_reasons vr WHERE lower(vr.label) = lower(seeds.label)
);
