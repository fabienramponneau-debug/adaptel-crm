-- ADAPTEL Lyon CRM - Complete Database Schema Export
-- This file contains the complete schema including tables, functions, triggers, and RLS policies
-- Ready to be imported into a fresh Supabase project

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to handle new user creation and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nom, prenom)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'nom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data ->> 'prenom', 'ADAPTEL')
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- TABLES
-- ============================================

-- Profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  nom text NOT NULL,
  prenom text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Etablissements table
CREATE TABLE public.etablissements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  nom_affiche text,
  nom_canonique text,
  adresse text,
  code_postal text,
  ville text,
  type text NOT NULL,
  secteur text,
  sous_secteur text,
  statut text,
  statut_commercial text,
  concurrent_principal text,
  coefficient numeric(6,3),
  groupe text,
  notes text,
  info_libre jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Contacts table
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  email text,
  telephone text,
  fonction text,
  preference_contact text,
  notes_contact text,
  info_libre jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Actions table
CREATE TABLE public.actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  contact_id uuid,
  type text NOT NULL,
  date timestamp with time zone NOT NULL,
  rappel_le timestamp with time zone,
  commentaire text,
  resultat text,
  assigned_to uuid,
  assigne_a uuid,
  info_libre jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Concurrence table
CREATE TABLE public.concurrence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  concurrent_principal text,
  postes text[],
  secteur text,
  sous_secteur text,
  coefficient_observe numeric(6,3),
  statut text DEFAULT 'actif',
  date_debut timestamp with time zone,
  date_fin timestamp with time zone,
  remarques text,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Etablissements Aliases table
CREATE TABLE public.etablissements_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL,
  alias text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Historique table
CREATE TABLE public.historique (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Utilisateurs internes table
CREATE TABLE public.utilisateurs_internes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  email text NOT NULL,
  role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger on auth.users to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_etablissements_updated_at
  BEFORE UPDATE ON public.etablissements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_concurrence_updated_at
  BEFORE UPDATE ON public.concurrence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_utilisateurs_internes_updated_at
  BEFORE UPDATE ON public.utilisateurs_internes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concurrence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs_internes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Etablissements policies
CREATE POLICY "Users can view their own etablissements"
  ON public.etablissements
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own etablissements"
  ON public.etablissements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own etablissements"
  ON public.etablissements
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own etablissements"
  ON public.etablissements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Contacts policies
CREATE POLICY "Users can view their own contacts"
  ON public.contacts
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own contacts"
  ON public.contacts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Actions policies
CREATE POLICY "Users can view their own actions"
  ON public.actions
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create their own actions"
  ON public.actions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own actions"
  ON public.actions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own actions"
  ON public.actions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Concurrence policies
CREATE POLICY "Users can view their own concurrence"
  ON public.concurrence
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own concurrence"
  ON public.concurrence
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own concurrence"
  ON public.concurrence
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own concurrence"
  ON public.concurrence
  FOR DELETE
  USING (auth.uid() = user_id);

-- Historique policies
CREATE POLICY "Users can view their own historique"
  ON public.historique
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own historique"
  ON public.historique
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Utilisateurs internes policies
CREATE POLICY "Users can view all internal users"
  ON public.utilisateurs_internes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.utilisateurs_internes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.utilisateurs_internes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- INDEXES (Optional, for better performance)
-- ============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_etablissements_user_id ON public.etablissements(user_id);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_etablissement_id ON public.contacts(etablissement_id);
CREATE INDEX idx_actions_user_id ON public.actions(user_id);
CREATE INDEX idx_actions_etablissement_id ON public.actions(etablissement_id);
CREATE INDEX idx_concurrence_user_id ON public.concurrence(user_id);
CREATE INDEX idx_concurrence_etablissement_id ON public.concurrence(etablissement_id);
CREATE INDEX idx_historique_user_id ON public.historique(user_id);
CREATE INDEX idx_utilisateurs_internes_user_id ON public.utilisateurs_internes(user_id);

-- Indexes for soft delete and duplicate detection
CREATE INDEX IF NOT EXISTS idx_etablissements_deleted_at ON public.etablissements(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON public.contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_deleted_at ON public.actions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_lower ON public.etablissements(LOWER(REPLACE(nom, ' ', ''))) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_canonique_lower ON public.etablissements(LOWER(REPLACE(nom_canonique, ' ', ''))) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etablissements_active ON public.etablissements(user_id, nom_canonique, ville) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etablissements_location ON public.etablissements(code_postal, ville) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_actions_rappel_le ON public.actions(rappel_le) WHERE deleted_at IS NULL AND rappel_le IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_assigne_a ON public.actions(assigne_a) WHERE deleted_at IS NULL AND assigne_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actions_contact_id ON public.actions(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_concurrence_deleted_at ON public.concurrence(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_concurrence_statut ON public.concurrence(statut, etablissement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_etablissements_aliases_etablissement ON public.etablissements_aliases(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_etablissements_aliases_normalized ON public.etablissements_aliases(etablissement_id, LOWER(REPLACE(alias, ' ', '')));

-- ============================================
-- END OF SCHEMA EXPORT
-- ============================================
