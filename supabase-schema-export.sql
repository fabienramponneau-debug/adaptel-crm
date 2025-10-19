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
  adresse text,
  type text NOT NULL,
  statut text,
  notes text,
  secteur text,
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
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Actions table
CREATE TABLE public.actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  date timestamp with time zone NOT NULL,
  commentaire text,
  resultat text,
  assigned_to uuid,
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
  remarques text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
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

-- ============================================
-- END OF SCHEMA EXPORT
-- ============================================
