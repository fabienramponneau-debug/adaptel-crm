-- Add deleted_at column to etablissements, contacts, and actions tables for soft delete
ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create index on deleted_at for better query performance
CREATE INDEX IF NOT EXISTS idx_etablissements_deleted_at ON public.etablissements(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_deleted_at ON public.actions(deleted_at) WHERE deleted_at IS NULL;

-- Add index for duplicate detection (name and adresse)
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_lower ON public.etablissements(LOWER(REPLACE(nom, ' ', ''))) WHERE deleted_at IS NULL;

-- Update existing RLS policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Users can view their own etablissements" ON public.etablissements;
CREATE POLICY "Users can view their own etablissements"
  ON public.etablissements
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view their own contacts"
  ON public.contacts
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own actions" ON public.actions;
CREATE POLICY "Users can view their own actions"
  ON public.actions
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);