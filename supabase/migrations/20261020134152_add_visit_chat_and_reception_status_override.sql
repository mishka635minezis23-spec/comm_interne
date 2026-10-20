CREATE TABLE IF NOT EXISTS public.visit_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_messages_visit_created
  ON public.visit_messages (visit_id, created_at);

ALTER TABLE public.visit_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON TABLE public.visit_messages TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.visit_messages FROM anon, authenticated;

DROP POLICY IF EXISTS visit_messages_read_accessible ON public.visit_messages;
CREATE POLICY visit_messages_read_accessible
  ON public.visit_messages
  FOR SELECT
  TO authenticated
  USING (private.can_access_visit(visit_id));

DROP POLICY IF EXISTS visit_messages_insert_accessible ON public.visit_messages;
CREATE POLICY visit_messages_insert_accessible
  ON public.visit_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND private.can_access_visit(visit_id)
    AND EXISTS (
      SELECT 1
      FROM public.visits v
      WHERE v.id = visit_id
        AND v.response_status <> 'cancelled'
    )
  );

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
    AND presence_status <> 'completed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette visite est introuvable, annulée ou déjà terminée.';
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'visit_messages'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_messages';
  END IF;
END $$;
