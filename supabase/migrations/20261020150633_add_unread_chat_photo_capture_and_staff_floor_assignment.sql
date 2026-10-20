-- Per-user read cursor for every conversation.
CREATE TABLE IF NOT EXISTS public.visit_message_reads (
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, user_id)
);
ALTER TABLE public.visit_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.visit_message_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.visit_message_reads TO authenticated;

DROP POLICY IF EXISTS visit_message_reads_select_self ON public.visit_message_reads;
CREATE POLICY visit_message_reads_select_self
ON public.visit_message_reads
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) AND private.can_access_visit(visit_id));

CREATE OR REPLACE FUNCTION public.mark_visit_messages_read(p_visit_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.can_access_visit(p_visit_id) THEN
    RAISE EXCEPTION 'Conversation inaccessible.';
  END IF;
  INSERT INTO public.visit_message_reads (visit_id, user_id, last_read_at)
  VALUES (p_visit_id, (SELECT auth.uid()), now())
  ON CONFLICT (visit_id, user_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_visit_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_visit_messages_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unread_visit_chats()
RETURNS TABLE (visit_id uuid, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.visit_id, count(*)::bigint AS unread_count
  FROM public.visit_messages AS m
  LEFT JOIN public.visit_message_reads AS r
    ON r.visit_id = m.visit_id AND r.user_id = (SELECT auth.uid())
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND m.sender_id <> (SELECT auth.uid())
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    AND private.can_access_visit(m.visit_id)
  GROUP BY m.visit_id;
$$;
REVOKE ALL ON FUNCTION public.get_unread_visit_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_visit_chats() TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('visitor-photos','visitor-photos',false,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public=false,file_size_limit=3145728,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS visitor_photos_read_accessible ON storage.objects;
CREATE POLICY visitor_photos_read_accessible
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='visitor-photos' AND private.can_access_visit(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS visitor_photos_insert_reception ON storage.objects;
CREATE POLICY visitor_photos_insert_reception
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='visitor-photos'
  AND private.has_role(ARRAY['admin','reception','secretary']::text[])
  AND EXISTS (
    SELECT 1 FROM public.visits AS v
    WHERE v.id=((storage.foldername(name))[1])::uuid AND v.created_by=(SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS visitor_photos_delete_creator ON storage.objects;
CREATE POLICY visitor_photos_delete_creator
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='visitor-photos'
  AND EXISTS (
    SELECT 1 FROM public.visits AS v
    WHERE v.id=((storage.foldername(name))[1])::uuid AND v.created_by=(SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.set_visit_photo_path(p_visit_id uuid,p_photo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin','reception','secretary']::text[]) THEN
    RAISE EXCEPTION 'Action réservée à la réception.';
  END IF;
  IF p_photo_path IS NULL OR left(p_photo_path,length(p_visit_id::text)+1) <> p_visit_id::text || '/' THEN
    RAISE EXCEPTION 'Chemin de photo invalide.';
  END IF;
  UPDATE public.visits SET visitor_photo_path=p_photo_path
  WHERE id=p_visit_id AND created_by=(SELECT auth.uid()) AND response_status<>'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Visite introuvable ou non autorisée.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_visit_photo_path(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_visit_photo_path(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_member_floor(p_member_id uuid,p_floor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT private.has_role(ARRAY['admin']::text[]) THEN
    RAISE EXCEPTION 'Seul un administrateur peut affecter un étage.';
  END IF;
  IF p_floor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.floors WHERE id=p_floor_id AND is_active=true) THEN
    RAISE EXCEPTION 'Étage introuvable ou désactivé.';
  END IF;
  UPDATE public.staff_members SET floor_id=p_floor_id,updated_at=now() WHERE id=p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collaborateur introuvable.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_assign_member_floor(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_member_floor(uuid,uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='visit_message_reads') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.visit_message_reads';
  END IF;
END $$;
