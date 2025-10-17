-- Créer la table utilisateurs_internes
CREATE TABLE public.utilisateurs_internes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Activer RLS
ALTER TABLE public.utilisateurs_internes ENABLE ROW LEVEL SECURITY;

-- Policies pour utilisateurs_internes
CREATE POLICY "Users can view all internal users"
ON public.utilisateurs_internes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.utilisateurs_internes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.utilisateurs_internes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Ajouter colonne assigned_to sur actions
ALTER TABLE public.actions
ADD COLUMN assigned_to UUID REFERENCES public.utilisateurs_internes(id);

-- Trigger pour updated_at sur utilisateurs_internes
CREATE TRIGGER update_utilisateurs_internes_updated_at
BEFORE UPDATE ON public.utilisateurs_internes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();