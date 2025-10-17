-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
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

-- Trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create etablissements table
CREATE TABLE public.etablissements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  adresse TEXT,
  type TEXT NOT NULL CHECK (type IN ('client', 'prospect')),
  secteur TEXT,
  statut TEXT,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_etablissements_updated_at
BEFORE UPDATE ON public.etablissements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Etablissements RLS policies
CREATE POLICY "Users can view their own etablissements" 
ON public.etablissements 
FOR SELECT 
USING (auth.uid() = user_id);

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

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  fonction TEXT,
  telephone TEXT,
  email TEXT,
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts RLS policies
CREATE POLICY "Users can view their own contacts" 
ON public.contacts 
FOR SELECT 
USING (auth.uid() = user_id);

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

-- Create actions table
CREATE TABLE public.actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('appel', 'visite', 'mail', 'autre')),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  commentaire TEXT,
  resultat TEXT,
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_actions_updated_at
BEFORE UPDATE ON public.actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Actions RLS policies
CREATE POLICY "Users can view their own actions" 
ON public.actions 
FOR SELECT 
USING (auth.uid() = user_id);

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

-- Create concurrence table
CREATE TABLE public.concurrence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  concurrent_principal TEXT,
  remarques TEXT,
  etablissement_id UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.concurrence ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_concurrence_updated_at
BEFORE UPDATE ON public.concurrence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Concurrence RLS policies
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

-- Create historique table
CREATE TABLE public.historique (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  data JSONB,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.historique ENABLE ROW LEVEL SECURITY;

-- Historique RLS policies
CREATE POLICY "Users can view their own historique" 
ON public.historique 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own historique" 
ON public.historique 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_etablissements_user_id ON public.etablissements(user_id);
CREATE INDEX idx_etablissements_type ON public.etablissements(type);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_etablissement_id ON public.contacts(etablissement_id);
CREATE INDEX idx_actions_user_id ON public.actions(user_id);
CREATE INDEX idx_actions_etablissement_id ON public.actions(etablissement_id);
CREATE INDEX idx_actions_date ON public.actions(date);
CREATE INDEX idx_concurrence_user_id ON public.concurrence(user_id);
CREATE INDEX idx_concurrence_etablissement_id ON public.concurrence(etablissement_id);
CREATE INDEX idx_historique_user_id ON public.historique(user_id);