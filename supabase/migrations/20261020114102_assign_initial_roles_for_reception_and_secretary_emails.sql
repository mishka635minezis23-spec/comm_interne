CREATE OR REPLACE FUNCTION private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(coalesce(new.email, ''));
  v_role text;
  v_full_name text;
BEGIN
  v_role := CASE v_email
    WHEN 'reception@ujadiongd.org' THEN 'reception'
    WHEN 'sec@ujadiongd.org' THEN 'secretary'
    ELSE 'member'
  END;

  v_full_name := CASE v_email
    WHEN 'reception@ujadiongd.org' THEN 'Réception'
    WHEN 'sec@ujadiongd.org' THEN 'Secrétariat'
    ELSE coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Nouveau membre'
    )
  END;

  INSERT INTO public.staff_members (id, full_name, email, role)
  VALUES (new.id, v_full_name, new.email, v_role)
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
