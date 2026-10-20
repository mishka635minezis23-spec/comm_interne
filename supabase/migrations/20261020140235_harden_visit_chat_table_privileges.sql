REVOKE ALL ON TABLE public.visit_messages FROM anon, PUBLIC;
GRANT SELECT, INSERT ON TABLE public.visit_messages TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.visit_messages FROM authenticated;