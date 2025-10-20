-- ============================================
-- MIGRATION UP: Adaptation CRM Hôtellerie/Restauration
-- ============================================

-- 1) Enrichir la table etablissements
ALTER TABLE public.etablissements 
  ADD COLUMN IF NOT EXISTS nom_affiche text,
  ADD COLUMN IF NOT EXISTS nom_canonique text,
  ADD COLUMN IF NOT EXISTS code_postal text,
  ADD COLUMN IF NOT EXISTS ville text,
  ADD COLUMN IF NOT EXISTS sous_secteur text,
  ADD COLUMN IF NOT EXISTS statut_commercial text,
  ADD COLUMN IF NOT EXISTS concurrent_principal text,
  ADD COLUMN IF NOT EXISTS coefficient numeric(6,3),
  ADD COLUMN IF NOT EXISTS groupe text,
  ADD COLUMN IF NOT EXISTS info_libre jsonb;

-- Mise à jour du nom_canonique pour les établissements existants (normalisé)
UPDATE public.etablissements 
SET nom_canonique = LOWER(TRIM(REGEXP_REPLACE(nom, '\s+', ' ', 'g')))
WHERE nom_canonique IS NULL AND nom IS NOT NULL;

-- Index pour déduplication
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_canonique_lower 
  ON public.etablissements(LOWER(REPLACE(nom_canonique, ' ', ''))) 
  WHERE deleted_at IS NULL;

-- Index partiel pour les établissements actifs
CREATE INDEX IF NOT EXISTS idx_etablissements_active 
  ON public.etablissements(user_id, nom_canonique, ville) 
  WHERE deleted_at IS NULL;

-- Index pour le code postal et la ville
CREATE INDEX IF NOT EXISTS idx_etablissements_location 
  ON public.etablissements(code_postal, ville) 
  WHERE deleted_at IS NULL;

-- 2) Créer la table etablissements_aliases
CREATE TABLE IF NOT EXISTS public.etablissements_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index sur les alias
CREATE INDEX IF NOT EXISTS idx_etablissements_aliases_etablissement 
  ON public.etablissements_aliases(etablissement_id);

CREATE INDEX IF NOT EXISTS idx_etablissements_aliases_normalized 
  ON public.etablissements_aliases(etablissement_id, LOWER(REPLACE(alias, ' ', '')));

-- RLS pour etablissements_aliases
ALTER TABLE public.etablissements_aliases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view aliases of their establishments" ON public.etablissements_aliases;
CREATE POLICY "Users can view aliases of their establishments"
  ON public.etablissements_aliases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.etablissements 
      WHERE etablissements.id = etablissements_aliases.etablissement_id 
        AND etablissements.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create aliases for their establishments" ON public.etablissements_aliases;
CREATE POLICY "Users can create aliases for their establishments"
  ON public.etablissements_aliases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.etablissements 
      WHERE etablissements.id = etablissements_aliases.etablissement_id 
        AND etablissements.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete aliases of their establishments" ON public.etablissements_aliases;
CREATE POLICY "Users can delete aliases of their establishments"
  ON public.etablissements_aliases
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.etablissements 
      WHERE etablissements.id = etablissements_aliases.etablissement_id 
        AND etablissements.user_id = auth.uid()
    )
  );

-- 3) Enrichir la table contacts
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS preference_contact text,
  ADD COLUMN IF NOT EXISTS notes_contact text,
  ADD COLUMN IF NOT EXISTS info_libre jsonb;

-- 4) Enrichir la table actions
ALTER TABLE public.actions 
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rappel_le timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assigne_a uuid REFERENCES public.utilisateurs_internes(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS info_libre jsonb;

-- Index pour les rappels
CREATE INDEX IF NOT EXISTS idx_actions_rappel_le 
  ON public.actions(rappel_le) 
  WHERE deleted_at IS NULL AND rappel_le IS NOT NULL;

-- Index pour les actions assignées
CREATE INDEX IF NOT EXISTS idx_actions_assigne_a 
  ON public.actions(assigne_a) 
  WHERE deleted_at IS NULL AND assigne_a IS NOT NULL;

-- Index pour le contact_id
CREATE INDEX IF NOT EXISTS idx_actions_contact_id 
  ON public.actions(contact_id) 
  WHERE deleted_at IS NULL;

-- 5) Enrichir la table concurrence
ALTER TABLE public.concurrence 
  ADD COLUMN IF NOT EXISTS postes text[],
  ADD COLUMN IF NOT EXISTS secteur text,
  ADD COLUMN IF NOT EXISTS sous_secteur text,
  ADD COLUMN IF NOT EXISTS coefficient_observe numeric(6,3),
  ADD COLUMN IF NOT EXISTS statut text DEFAULT 'actif',
  ADD COLUMN IF NOT EXISTS date_debut timestamp with time zone,
  ADD COLUMN IF NOT EXISTS date_fin timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Index pour la concurrence
CREATE INDEX IF NOT EXISTS idx_concurrence_deleted_at 
  ON public.concurrence(deleted_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_concurrence_statut 
  ON public.concurrence(statut, etablissement_id) 
  WHERE deleted_at IS NULL;