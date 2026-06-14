
CREATE OR REPLACE FUNCTION public.protect_consultations_notes_internal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role and admins can write notes_internal freely
  IF auth.role() = 'service_role' OR public.has_role('admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.notes_internal := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- preserve any existing value; non-admins cannot change it
    NEW.notes_internal := OLD.notes_internal;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_consultations_notes_internal_trg ON public.consultations;
CREATE TRIGGER protect_consultations_notes_internal_trg
BEFORE INSERT OR UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.protect_consultations_notes_internal();
