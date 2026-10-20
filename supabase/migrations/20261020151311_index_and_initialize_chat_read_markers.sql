CREATE INDEX IF NOT EXISTS idx_visit_message_reads_user
ON public.visit_message_reads (user_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_messages_sender_created
ON public.visit_messages (sender_id, created_at DESC);

INSERT INTO public.visit_message_reads (visit_id, user_id, last_read_at)
SELECT v.id, v.created_by, now()
FROM public.visits AS v
WHERE EXISTS (SELECT 1 FROM public.visit_messages m WHERE m.visit_id = v.id)
UNION
SELECT vr.visit_id, vr.member_id, now()
FROM public.visit_recipients AS vr
WHERE EXISTS (SELECT 1 FROM public.visit_messages m WHERE m.visit_id = vr.visit_id)
ON CONFLICT (visit_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_unread_visit_chats()
RETURNS TABLE (visit_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT m.visit_id, count(*)::bigint AS unread_count
  FROM public.visit_messages AS m
  LEFT JOIN public.visit_message_reads AS r
    ON r.visit_id = m.visit_id
   AND r.user_id = (SELECT auth.uid())
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND m.sender_id <> (SELECT auth.uid())
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    AND private.can_access_visit(m.visit_id)
  GROUP BY m.visit_id;
$$;
REVOKE ALL ON FUNCTION public.get_unread_visit_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_visit_chats() TO authenticated;