CREATE OR REPLACE FUNCTION public.reception_update_visit_response(
  p_visit_id uuid,
  p_response_status text,
  p_wait_minutes integer DEFAULT 5,
  p_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous_status text;
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Action réservée à la réception et au secrétariat.';
  END IF;

  IF p_response_status NOT IN ('authorized','waiting','unavailable') THEN
    RAISE EXCEPTION 'Réponse de visite invalide.';
  END IF;

  IF p_response_status = 'waiting' AND (p_wait_minutes IS NULL OR p_wait_minutes < 1 OR p_wait_minutes > 120) THEN
    RAISE EXCEPTION 'Le délai doit être compris entre 1 et 120 minutes.';
  END IF;

  SELECT response_status INTO v_previous_status
  FROM public.visits
  WHERE id = p_visit_id
    AND response_status <> 'cancelled'
    AND presence_status = 'not_arrived'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La décision ne peut plus changer après l’entrée du visiteur ou la clôture de la visite.';
  END IF;

  UPDATE public.visits
  SET response_status = p_response_status,
      response_at = now(),
      response_message = nullif(btrim(coalesce(p_message, '')), ''),
      waiting_until = CASE
        WHEN p_response_status = 'waiting' THEN now() + make_interval(mins => p_wait_minutes)
        ELSE NULL
      END
  WHERE id = p_visit_id;

  UPDATE public.visit_recipients
  SET status = 'responded',
      response_code = p_response_status,
      responded_at = now()
  WHERE visit_id = p_visit_id
    AND status IN ('pending','notified','viewed','claimed','responded');

  INSERT INTO public.visit_events (visit_id, actor_id, event_type, event_data)
  VALUES (
    p_visit_id,
    (SELECT auth.uid()),
    'reception_response_changed',
    jsonb_build_object(
      'previous_status', v_previous_status,
      'response_status', p_response_status,
      'wait_minutes', CASE WHEN p_response_status = 'waiting' THEN p_wait_minutes ELSE NULL END,
      'message', nullif(btrim(coalesce(p_message, '')), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reception_update_visit_response(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reception_update_visit_response(uuid, text, integer, text) TO authenticated;
