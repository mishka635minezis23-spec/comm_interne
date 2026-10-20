CREATE OR REPLACE FUNCTION private.can_access_visit(p_visit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.visits v
    WHERE v.id = p_visit_id
      AND (
        v.created_by = (select auth.uid())
        OR private.has_role(ARRAY['admin','reception','secretary']::text[])
        OR EXISTS (
          SELECT 1 FROM public.visit_recipients vr
          WHERE vr.visit_id = v.id AND vr.member_id = (select auth.uid())
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION private.can_access_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_access_visit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_visit(
  p_visit_id uuid,
  p_visitor_name text,
  p_visitor_organization text,
  p_photo_path text,
  p_reason_id uuid,
  p_note text,
  p_member_ids uuid[],
  p_urgency text DEFAULT 'normal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := coalesce(p_visit_id, gen_random_uuid());
  v_count integer;
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Accès réservé à la réception et au secrétariat.';
  END IF;
  IF nullif(trim(p_visitor_name), '') IS NULL THEN
    RAISE EXCEPTION 'Le nom du visiteur est obligatoire.';
  END IF;
  IF p_member_ids IS NULL OR cardinality(p_member_ids) < 1 OR cardinality(p_member_ids) > 20 THEN
    RAISE EXCEPTION 'Sélectionnez entre 1 et 20 destinataires.';
  END IF;
  IF p_urgency NOT IN ('normal','urgent') THEN
    RAISE EXCEPTION 'Niveau d’urgence invalide.';
  END IF;
  SELECT count(distinct x) INTO v_count FROM unnest(p_member_ids) AS x;
  IF v_count <> cardinality(p_member_ids) THEN
    RAISE EXCEPTION 'Un même collaborateur a été sélectionné plusieurs fois.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_member_ids) AS x
    LEFT JOIN public.staff_members sm ON sm.id = x
    WHERE sm.id IS NULL OR sm.is_active = false
  ) THEN
    RAISE EXCEPTION 'Un destinataire est introuvable ou désactivé.';
  END IF;

  INSERT INTO public.visits
    (id, created_by, visitor_name, visitor_organization, visitor_photo_path, reason_id, note, urgency, target_mode)
  VALUES
    (v_id, (select auth.uid()), trim(p_visitor_name),
     nullif(trim(coalesce(p_visitor_organization,'')),''),
     nullif(p_photo_path,''), p_reason_id,
     nullif(trim(coalesce(p_note,'')),''),
     p_urgency,
     CASE WHEN cardinality(p_member_ids) = 1 THEN 'individual' ELSE 'group' END);

  INSERT INTO public.visit_recipients (visit_id, member_id)
  SELECT v_id, x FROM unnest(p_member_ids) AS x;

  INSERT INTO public.visit_events (visit_id, actor_id, event_type, event_data)
  VALUES (v_id, (select auth.uid()), 'visit_created',
          jsonb_build_object('recipient_count', cardinality(p_member_ids), 'urgency', p_urgency));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_visit(uuid,text,text,text,uuid,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_visit(uuid,text,text,text,uuid,text,uuid[],text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_visit_presence(p_visit_id uuid, p_presence_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Accès réservé à la réception et au secrétariat.';
  END IF;
  IF p_presence_status NOT IN ('in_visit','completed') THEN
    RAISE EXCEPTION 'Statut de présence invalide.';
  END IF;
  UPDATE public.visits
    SET presence_status = p_presence_status,
        closed_at = CASE WHEN p_presence_status = 'completed' THEN now() ELSE NULL END
    WHERE id = p_visit_id AND response_status = 'authorized';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La visite doit être autorisée avant de modifier sa présence.';
  END IF;
  INSERT INTO public.visit_events (visit_id, actor_id, event_type, event_data)
  VALUES (p_visit_id, (select auth.uid()),
          CASE WHEN p_presence_status = 'completed' THEN 'visit_completed' ELSE 'visitor_arrived' END,
          jsonb_build_object('presence_status', p_presence_status));
END;
$$;
REVOKE ALL ON FUNCTION public.set_visit_presence(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_visit_presence(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_visit_no_response(p_visit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Accès réservé à la réception et au secrétariat.';
  END IF;
  UPDATE public.visits
    SET response_status = 'no_response'
    WHERE id = p_visit_id
      AND response_status IN ('pending','viewed')
      AND created_at <= now() - interval '2 minutes';
  IF FOUND THEN
    UPDATE public.visit_recipients SET status = 'closed'
    WHERE visit_id = p_visit_id AND status IN ('pending','notified','viewed');
    INSERT INTO public.visit_events (visit_id, actor_id, event_type)
    VALUES (p_visit_id, (select auth.uid()), 'visit_no_response');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_visit_no_response(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_visit_no_response(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_visit(p_visit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Accès réservé à la réception et au secrétariat.';
  END IF;
  UPDATE public.visits
    SET response_status = 'cancelled', closed_at = now()
    WHERE id = p_visit_id
      AND response_status IN ('pending','viewed','authorized','waiting','unavailable','no_response');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette visite ne peut plus être annulée.';
  END IF;
  UPDATE public.visit_recipients SET status = 'closed' WHERE visit_id = p_visit_id;
  INSERT INTO public.visit_events (visit_id, actor_id, event_type)
  VALUES (p_visit_id, (select auth.uid()), 'visit_cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_visit(uuid) TO authenticated;
