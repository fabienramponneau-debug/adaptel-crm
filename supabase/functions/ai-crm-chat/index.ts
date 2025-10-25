import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= DATE PARSING FR =============
// Parse French dates with Europe/Paris timezone
function parseFrenchDate(dateStr: string, defaultHour = 9, defaultMinute = 0): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const now = new Date();
  const parisOffset = 1; // Europe/Paris UTC+1 (simplification, ignore DST for now)
  
  const trimmed = dateStr.trim().toLowerCase();
  
  // Relative dates
  if (trimmed === 'demain' || trimmed === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(defaultHour, defaultMinute, 0, 0);
    return tomorrow;
  }
  
  if (trimmed === 'après-demain' || trimmed === 'apres-demain') {
    const afterTomorrow = new Date(now);
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    afterTomorrow.setHours(defaultHour, defaultMinute, 0, 0);
    return afterTomorrow;
  }
  
  // "dans X jours/semaines"
  const inDaysMatch = trimmed.match(/dans\s+(\d+)\s+jours?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    const future = new Date(now);
    future.setDate(future.getDate() + days);
    future.setHours(defaultHour, defaultMinute, 0, 0);
    return future;
  }
  
  const inWeeksMatch = trimmed.match(/dans\s+(\d+)\s+semaines?/);
  if (inWeeksMatch) {
    const weeks = parseInt(inWeeksMatch[1]);
    const future = new Date(now);
    future.setDate(future.getDate() + (weeks * 7));
    future.setHours(defaultHour, defaultMinute, 0, 0);
    return future;
  }
  
  // "la semaine prochaine"
  if (trimmed.includes('semaine prochaine')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(defaultHour, defaultMinute, 0, 0);
    return nextWeek;
  }
  
  // Days of week
  const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (trimmed.startsWith(daysOfWeek[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
      
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
      
      // Check for hour in string (e.g., "lundi 15h" or "lundi 15:30")
      const hourMatch = trimmed.match(/(\d{1,2})[:h](\d{2})?/);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1]);
        const minute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
        targetDate.setHours(hour, minute, 0, 0);
      } else {
        targetDate.setHours(defaultHour, defaultMinute, 0, 0);
      }
      
      return targetDate;
    }
  }
  
  // Extract hour if present
  let hour = defaultHour;
  let minute = defaultMinute;
  const hourMatch = dateStr.match(/(\d{1,2})[:h](\d{2})?/);
  if (hourMatch) {
    hour = parseInt(hourMatch[1]);
    minute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
  }
  
  // French month names
  const monthsFr = {
    'janvier': 0, 'jan': 0,
    'février': 1, 'fev': 1, 'fevrier': 1, 'feb': 1,
    'mars': 2, 'mar': 2,
    'avril': 3, 'avr': 3, 'apr': 3,
    'mai': 4, 'may': 4,
    'juin': 5, 'jun': 5,
    'juillet': 6, 'juil': 6, 'jul': 6,
    'août': 7, 'aout': 7, 'aug': 7,
    'septembre': 8, 'sept': 8, 'sep': 8,
    'octobre': 9, 'oct': 9,
    'novembre': 10, 'nov': 10,
    'décembre': 11, 'dec': 11, 'decembre': 11
  };
  
  // "11 novembre", "11 novembre 2025", "11 nov"
  for (const [monthName, monthIndex] of Object.entries(monthsFr)) {
    const regex = new RegExp(`(\\d{1,2})\\s+${monthName}(?:\\s+(\\d{4}))?`, 'i');
    const match = dateStr.match(regex);
    if (match) {
      const day = parseInt(match[1]);
      const year = match[2] ? parseInt(match[2]) : now.getFullYear();
      const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
      
      // If date is in the past this year and no year specified, use next year
      if (!match[2] && date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      
      return date;
    }
  }
  
  // Numeric formats: "11/11", "11/11/25", "11-11-2025", "11/11/2025"
  const numericMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]);
    const month = parseInt(numericMatch[2]) - 1; // 0-indexed
    let year = now.getFullYear();
    
    if (numericMatch[3]) {
      year = parseInt(numericMatch[3]);
      if (year < 100) year += 2000; // 25 -> 2025
    }
    
    const date = new Date(year, month, day, hour, minute, 0, 0);
    
    // If date is in the past this year and no year specified, use next year
    if (!numericMatch[3] && date < now) {
      date.setFullYear(date.getFullYear() + 1);
    }
    
    return date;
  }
  
  // Try ISO format as fallback
  try {
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}

// Helper function for fuzzy establishment matching
function normalizeForMatch(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\b(de|du|de la|des|le|la|les|l')\b/g, '') // remove articles
    .replace(/[^\w]/g, '') // remove punctuation/spaces
    .trim();
}

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Tu es l'assistant IA du CRM ADAPTEL Lyon (agence de travail temporaire spécialisée en Hôtellerie/Restauration).

TU ES UN VRAI ASSISTANT COMMERCIAL - PRINCIPES ABSOLUS :
1. JAMAIS bloquer une action pour champs manquants → créer avec minimum, compléter plus tard
2. TOUJOURS exécuter immédiatement ce qui est demandé
3. TOUJOURS confirmer avec phrase simple et naturelle (JAMAIS de JSON visible)
4. JAMAIS poser de questions inutiles → deviner intelligemment ou prendre défaut raisonnable
5. JAMAIS créer de doublons → TOUJOURS chercher d'abord avec search_etablissement_fuzzy
6. TOUJOURS réessayer automatiquement en cas d'erreur technique

GARDE-FOU INTERNE :
- JAMAIS créer d'établissement pour ADAPTEL (notre société)
- Si détecté "ADAPTEL", "ADAPTEL Lyon", "ADAPTEL Intérim", etc. → répondre : "C'est notre société, je n'enregistre pas d'établissement pour nous."

IDENTIFICATION D'ÉTABLISSEMENT (RÈGLE CRITIQUE) :
AVANT toute action (création, rappel, concurrence, contact) :
1. TOUJOURS utiliser search_etablissement_fuzzy avec le nom mentionné + ville si présente
2. Si 1 seul match confiant → l'utiliser directement (pas de question)
3. Si 2-3 candidats plausibles → poser UNE confirmation courte :
   "Vous parlez de :
   1. Novotel Bron (Bron)
   2. Novotel Lyon Bron (Saint-Priest)
   3. Autre / Nouveau"
4. Si "Autre/Nouveau" ou aucun match → créer nouveau (minimale)
5. Si variante détectée (ex: "Novotel de Bron" → "Novotel Bron") → créer alias automatiquement (silencieux)

ALIAS AUTOMATIQUES :
- Quand une variante de nom est utilisée et reconnue → ajouter alias à la fiche (create_alias)
- JAMAIS créer d'alias pour ADAPTEL
- Silencieux : pas de message à l'utilisateur, juste faire

CRÉATION TOLÉRANTE (JAMAIS BLOQUER) :
- Créer établissement UNIQUEMENT après search_etablissement_fuzzy sans résultat
- Socle minimal : nom + user_id + type='prospect'
- Mapping automatique du type :
  * "client actuel" / "client" → type='client', statut_commercial='gagné'
  * "prospect" → type='prospect', statut_commercial='à_contacter'
- Si erreur DB → retry avec création minimale automatique
- Si trouvé existant → UPDATE (pas de nouveau)

MAPPING AUTOMATIQUE (zéro friction) :
- "Client actuel Novotel Bron (Bron), coef 2.048, groupe ACCOR" → type='client', statut_commercial='gagné', ville='Bron', coefficient=2.048, groupe='ACCOR'
- "Prospect Hôtel Y (Lyon)" → type='prospect', statut_commercial='à_contacter', ville='Lyon'
- "RDV demain 15h" → action type='visite' + rappel_le automatique (1h avant)
- "Dis à Céline d'appeler..." → assigne_a (via utilisateurs_internes)
- Tout hors schéma → info_libre jsonb

SECTEURS : hôtellerie, restauration, hôtellerie-restauration, restauration_collective
SOUS-SECTEURS : hôtel_1..5_étoiles, EHPAD, crèche, scolaire, résidence_hôtelière, etc.
NORMALISATION SECTEUR : "hôtellerie restauration", "HR" → traiter comme 'hôtellerie' ET 'restauration'

DÉDUPLICATION SILENCIEUSE :
- Vérifier nom_canonique + ville + aliases avant création
- Si doublon détecté → UPDATE fiche existante (pas de nouvelle fiche)
- Log historique de la fusion

NOM CANONIQUE & ALIASES :
- Calcule automatiquement nom_canonique (minuscule, sans accents, sans espaces)
- Si variante de nom détectée → crée etablissements_aliases automatiquement

DATES FRANÇAISES (parsing robuste) :
- Formats naturels : "11 novembre", "11 nov", "11 novembre 2025"
- Formats numériques : "11/11", "11/11/25", "11-11-2025"
- Relatifs : "demain", "après-demain", "lundi", "lundi 15h", "dans 2 jours", "dans 3 semaines", "la semaine prochaine"
- Heure optionnelle : si présente (15h, 15:30) l'utiliser, sinon défaut 09:00
- Année manquante : année courante ; si date passée → année +1
- Fuseau : Europe/Paris (toujours)
- Si date ambiguë → message court "Date ambiguë" SANS bloquer le reste

RAPPELS - CRITIQUE (100% réussite garantie) :
- Pour "rappelle-moi..." / "enregistre un rappel {date} ... {Établissement}" :
  * Fuzzy-match établissement (nom/nom_canonique/alias/ville)
  * Si pas trouvé → création minimale AUTOMATIQUE (nom + type='prospect' + user_id)
  * Type action : TOUJOURS 'appel' (la contrainte DB n'accepte que : appel, visite, mail, autre)
  * OBLIGATOIRE : remplir date ET rappel_le avec la MÊME valeur datetime
  * Toujours user_id = auth.uid()
  * Ne JAMAIS bloquer si ville/coef/groupe manquent
  * Si échec → retry automatique (recréer établissement + action)
  * Confirmation naturelle : "✓ Rappel enregistré pour {date} : {commentaire} ({établissement})"

TYPES D'ACTIONS VALIDES (contrainte DB stricte) :
- 'appel' : pour appels téléphoniques ET rappels (rappel_le indique si c'est un rappel)
- 'visite' : pour visites/RDV en personne
- 'mail' : pour emails
- 'autre' : pour toute autre action

CONCURRENCE :
- postes[], secteur (hérité de l'établissement si absent), coefficient_observe, statut
- "Quel concurrent le plus présent sur {secteur}" → Top 3 avec décompte
- "Quels concurrents en base" → liste distincte Top 10

REQUÊTES RAPPELS & ACTIONS :
- "Rappels de la semaine" / "Mes rappels" → actions type='appel' avec rappel_le dans période
- "Actions commerciales en cours" → actions récentes (30 derniers jours)

ASSIGNATIONS : "Dis à Céline..." → assigne_a
SUPPRESSION : toujours soft delete (deleted_at)

CONFIRMATIONS (OBLIGATOIRE après chaque action) :
- Utilise TOUJOURS le message de confirmation fourni par l'outil (champ "message" dans tool_result)
- Si l'outil retourne un message, répète-le textuellement à l'utilisateur (ne le reformule pas)
- Si pas de message fourni, utilise ces formats :
  * Création établissement : "✓ {Nom} enregistré comme {type} ({ville si présente})"
  * Promotion prospect→client : "✓ {Nom} promu de prospect à client"
  * Rappel créé : "✓ Rappel enregistré pour {date} : {commentaire}"
  * Action créée : "✓ Action {type} enregistrée pour {établissement}"
  * Mise à jour : "✓ {Nom} mis à jour"
  * Fusion doublon : "✓ {Nom} fusionné avec fiche existante"
- Sois bref, naturel, sans jargon technique
- Un seul symbole ✓ par confirmation

Date du jour : ${new Date().toISOString()}
Réponds toujours en français de façon naturelle et fluide.`;

// Tools definition for structured output
const tools = [
  {
    type: "function",
    function: {
      name: "search_etablissement_fuzzy",
      description: "OBLIGATOIRE AVANT toute action : recherche tolérante d'établissement (accents, articles, espaces, casse, abréviations). Retourne candidats triés par pertinence. Si 1 seul → auto-match. Si 2-3 → demander confirmation. Si 0 → créer.",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom recherché (obligatoire)" },
          ville: { type: "string", description: "Ville (optionnel, améliore pertinence)" }
        },
        required: ["nom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_etablissement",
      description: "Créer un nouvel établissement UNIQUEMENT après search_etablissement_fuzzy sans résultat. Mapping auto: 'client actuel'→type='client'+statut_commercial='gagné', 'prospect'→type='prospect'+statut_commercial='à_contacter'. JAMAIS bloquer si champs manquants (ville, coef, groupe, etc.)",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement (OBLIGATOIRE)" },
          nom_affiche: { type: "string", description: "Nom d'affichage (optionnel)" },
          adresse: { type: "string", description: "Adresse complète (optionnel)" },
          code_postal: { type: "string", description: "Code postal (optionnel)" },
          ville: { type: "string", description: "Ville (optionnel)" },
          type: { 
            type: "string", 
            enum: ["client", "prospect", "ancien_client"],
            description: "Type: 'client' (si 'client actuel'), 'prospect' (défaut), 'ancien_client'"
          },
          secteur: { type: "string", description: "Secteur: hôtellerie/restauration/hôtellerie-restauration/restauration_collective (optionnel)" },
          sous_secteur: { type: "string", description: "Sous-secteur: hôtel_1..5_étoiles, EHPAD, crèche, scolaire, etc. (optionnel)" },
          statut_commercial: { type: "string", description: "Statut commercial: 'gagné' (si client actuel), 'à_contacter' (si prospect), etc. (optionnel)" },
          concurrent_principal: { type: "string", description: "Concurrent principal (optionnel)" },
          coefficient: { type: "number", description: "Coefficient commercial ex: 2.048 (optionnel)" },
          groupe: { type: "string", description: "Groupe ex: ACCOR, B&B Hotels (optionnel)" },
          notes: { type: "string", description: "Notes diverses (optionnel)" },
          info_libre: { type: "object", description: "Données hors schéma jsonb ex: {postes:['cuisine']} (optionnel)" }
        },
        required: ["nom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Créer un nouveau contact pour un établissement",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          nom: { type: "string", description: "Nom du contact" },
          prenom: { type: "string", description: "Prénom du contact" },
          fonction: { type: "string", description: "Fonction du contact" },
          telephone: { type: "string", description: "Téléphone du contact" },
          email: { type: "string", description: "Email du contact" },
          preference_contact: { type: "string", description: "Préférence de contact" },
          notes_contact: { type: "string", description: "Notes sur le contact" },
          info_libre: { type: "object", description: "Données hors schéma (jsonb)" }
        },
        required: ["etablissement_nom", "nom", "prenom"]
      }
    }
  },
  {
    type: "function",
    function: {
          name: "create_action",
          description: "Créer une action commerciale ou un rappel. CRITIQUE: Pour rappels utiliser type='appel' (contrainte DB), date ET rappel_le identiques",
          parameters: {
            type: "object",
            properties: {
              etablissement_nom: { type: "string", description: "Nom de l'établissement" },
              contact_nom: { type: "string", description: "Nom du contact lié (optionnel)" },
              type: { 
                type: "string", 
                enum: ["appel", "visite", "mail", "autre"],
                description: "Type d'action VALIDE uniquement: 'appel' (pour appels ET rappels), 'visite' (pour RDV), 'mail', 'autre'. La DB n'accepte PAS 'rappel' ni 'rdv'."
              },
              date: { type: "string", description: "Date de l'action au format ISO 8601 ou FR (OBLIGATOIRE)" },
              rappel_le: { type: "string", description: "Date du rappel (pour rappels: MÊME valeur que date; pour visites: auto 1h avant)" },
              commentaire: { type: "string", description: "Commentaire/description de l'action" },
              resultat: { type: "string", description: "Résultat de l'action (optionnel)" },
              assigne_a_name: { type: "string", description: "Prénom du collaborateur à qui assigner (optionnel)" },
              info_libre: { type: "object", description: "Données hors schéma (jsonb)" }
            },
            required: ["etablissement_nom", "type", "date"]
          }
    }
  },
  {
    type: "function",
    function: {
      name: "search_etablissements",
      description: "Rechercher des établissements selon des critères",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement à rechercher" },
          type: { 
            type: "string", 
            enum: ["client", "prospect"],
            description: "Type d'établissement"
          },
          secteur: { type: "string", description: "Secteur d'activité" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_actions",
      description: "Rechercher des actions/rappels selon des critères. Pour rappels: filtrer type='appel' avec rappel_le non null",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          type: { 
            type: "string", 
            enum: ["appel", "visite", "mail", "autre"],
            description: "Type d'action valide"
          },
          date_debut: { type: "string", description: "Date de début au format ISO 8601" },
          date_fin: { type: "string", description: "Date de fin au format ISO 8601" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_etablissement_info",
      description: "Obtenir toutes les informations sur un établissement",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement" }
        },
        required: ["nom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_internal_users",
      description: "Rechercher des utilisateurs internes (collaborateurs ADAPTEL) par prénom ou nom",
      parameters: {
        type: "object",
        properties: {
          prenom: { type: "string", description: "Prénom à rechercher" },
          nom: { type: "string", description: "Nom à rechercher" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_internal_user",
      description: "Créer un nouvel utilisateur interne (collaborateur ADAPTEL)",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom du collaborateur" },
          prenom: { type: "string", description: "Prénom du collaborateur" },
          email: { type: "string", description: "Email du collaborateur" },
          role: { type: "string", description: "Rôle/fonction du collaborateur" }
        },
        required: ["nom", "prenom", "email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "detect_duplicates",
      description: "Détecter les établissements doublons par nom similaire",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement à vérifier" }
        },
        required: ["nom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "merge_etablissements",
      description: "Fusionner deux établissements doublons (garde le maître, repointe les relations)",
      parameters: {
        type: "object",
        properties: {
          nom_maitre: { type: "string", description: "Nom de l'établissement à garder (maître)" },
          nom_doublon: { type: "string", description: "Nom de l'établissement doublon à fusionner" }
        },
        required: ["nom_maitre", "nom_doublon"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "soft_delete_etablissement",
      description: "Supprimer (soft delete) un établissement",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement à supprimer" }
        },
        required: ["nom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_contacts",
      description: "Déplacer tous les contacts d'un établissement vers un autre",
      parameters: {
        type: "object",
        properties: {
          nom_source: { type: "string", description: "Nom de l'établissement source" },
          nom_destination: { type: "string", description: "Nom de l'établissement de destination" }
        },
        required: ["nom_source", "nom_destination"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_concurrence",
      description: "Créer ou mettre à jour une entrée de concurrence (postes, coefficient, statut)",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          concurrent_principal: { type: "string", description: "Nom du concurrent" },
          postes: { type: "array", items: { type: "string" }, description: "Postes concernés (ex: ['cuisine', 'service'])" },
          secteur: { type: "string", description: "Secteur" },
          sous_secteur: { type: "string", description: "Sous-secteur" },
          coefficient_observe: { type: "number", description: "Coefficient observé" },
          statut: { type: "string", enum: ["actif", "historique", "pressenti"], description: "Statut" },
          date_debut: { type: "string", description: "Date début ISO 8601" },
          date_fin: { type: "string", description: "Date fin ISO 8601" },
          remarques: { type: "string", description: "Remarques" }
        },
        required: ["etablissement_nom", "concurrent_principal"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_concurrence",
      description: "Interroger la concurrence (concurrent le plus présent, coef moyen, etc.). Retourne aussi liste distincte des concurrents avec compte.",
      parameters: {
        type: "object",
        properties: {
          concurrent: { type: "string", description: "Nom du concurrent à analyser" },
          poste: { type: "string", description: "Poste à filtrer" },
          secteur: { type: "string", description: "Secteur à filtrer" },
          list_all: { type: "boolean", description: "Si true, liste tous les concurrents distincts avec compte (Top 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_rappels",
      description: "Rechercher les rappels (actions type='rappel' ou 'appel') pour l'utilisateur courant, avec filtrage par période",
      parameters: {
        type: "object",
        properties: {
          date_debut: { type: "string", description: "Date de début au format ISO 8601" },
          date_fin: { type: "string", description: "Date de fin au format ISO 8601" },
          periode: { type: "string", enum: ["semaine", "mois", "today"], description: "Période prédéfinie: 'semaine' (7j), 'mois' (30j), 'today' (aujourd'hui)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_actions_en_cours",
      description: "Rechercher les actions commerciales en cours (30 derniers jours) pour l'utilisateur courant",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Nombre de jours dans le passé (défaut: 30)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_alias",
      description: "Ajouter AUTOMATIQUEMENT un alias pour un établissement (variantes de nom). SILENCIEUX : pas de message à l'utilisateur.",
      parameters: {
        type: "object",
        properties: {
          etablissement_id: { type: "string", description: "ID de l'établissement (UUID)" },
          alias: { type: "string", description: "Alias (variante du nom)" }
        },
        required: ["etablissement_id", "alias"]
      }
    }
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();

    if (!userId) {
      throw new Error('userId is required');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing AI request for user:', userId);

    // Call AI Gateway with tools
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        tools: tools,
        tool_choice: 'auto',
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse, null, 2));

    const assistantMessage = aiResponse.choices[0].message;
    
    // Handle tool calls if any
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing tool: ${functionName}`, args);

        let result;
        
        try {
          switch (functionName) {
            case 'search_etablissement_fuzzy':
              const searchNom = args.nom;
              const searchVille = args.ville;
              const normalizedSearch = normalizeForMatch(searchNom);
              
              // Get all etablissements for user
              const { data: etablissementsForFuzzy } = await supabase
                .from('etablissements')
                .select('id, nom, nom_canonique, ville, type, secteur, groupe, coefficient, created_at')
                .eq('user_id', userId)
                .is('deleted_at', null);
              
              if (!etablissementsForFuzzy || etablissementsForFuzzy.length === 0) {
                result = { 
                  success: true, 
                  matches: [],
                  message: "Aucun établissement trouvé" 
                };
                break;
              }
              
              // Get aliases
              const etabIds = etablissementsForFuzzy.map(e => e.id);
              const { data: aliases } = await supabase
                .from('etablissements_aliases')
                .select('etablissement_id, alias')
                .in('etablissement_id', etabIds);
              
              const aliasMap = new Map<string, string[]>();
              aliases?.forEach(a => {
                const existing = aliasMap.get(a.etablissement_id) || [];
                aliasMap.set(a.etablissement_id, [...existing, a.alias]);
              });
              
              // Score each etablissement
              type ScoredMatch = {
                id: string;
                nom: string;
                ville: string | null;
                type: string;
                score: number;
                matchType: string;
              };
              
              const matches: ScoredMatch[] = [];
              
              for (const etab of etablissementsForFuzzy) {
                let score = 0;
                let matchType = '';
                
                const normalizedNom = normalizeForMatch(etab.nom);
                const etabAliases = aliasMap.get(etab.id) || [];
                
                // Exact match (normalized)
                if (normalizedNom === normalizedSearch) {
                  score = 100;
                  matchType = 'exact';
                }
                // Alias exact match
                else if (etabAliases.some(a => normalizeForMatch(a) === normalizedSearch)) {
                  score = 95;
                  matchType = 'alias_exact';
                }
                // Contains (nom)
                else if (normalizedNom.includes(normalizedSearch) || normalizedSearch.includes(normalizedNom)) {
                  score = 70;
                  matchType = 'contains';
                }
                // Alias contains
                else if (etabAliases.some(a => {
                  const na = normalizeForMatch(a);
                  return na.includes(normalizedSearch) || normalizedSearch.includes(na);
                })) {
                  score = 65;
                  matchType = 'alias_contains';
                }
                // Partial word match (first 5 chars)
                else if (normalizedNom.length >= 5 && normalizedSearch.length >= 5 && 
                         normalizedNom.substring(0, 5) === normalizedSearch.substring(0, 5)) {
                  score = 50;
                  matchType = 'partial';
                }
                
                // Bonus if ville matches
                if (score > 0 && searchVille && etab.ville) {
                  const normalizedEtabVille = normalizeForMatch(etab.ville);
                  const normalizedSearchVille = normalizeForMatch(searchVille);
                  if (normalizedEtabVille === normalizedSearchVille) {
                    score += 20;
                    matchType += '_ville';
                  }
                }
                
                if (score > 0) {
                  matches.push({
                    id: etab.id,
                    nom: etab.nom,
                    ville: etab.ville,
                    type: etab.type,
                    score,
                    matchType
                  });
                }
              }
              
              // Sort by score desc
              matches.sort((a, b) => b.score - a.score);
              
              // Take top 3
              const topMatches = matches.slice(0, 3);
              
              result = { 
                success: true, 
                matches: topMatches,
                count: topMatches.length,
                message: topMatches.length === 0 ? "Aucune correspondance" :
                         topMatches.length === 1 ? `1 correspondance : ${topMatches[0].nom}` :
                         `${topMatches.length} correspondances possibles`
              };
              break;

            case 'create_etablissement':
              try {
                // GARDE-FOU INTERNE : Blacklist ADAPTEL
                const nomLowerAdaptel = args.nom.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (nomLowerAdaptel.includes('adaptel')) {
                  result = { 
                    success: false, 
                    error: "C'est notre société, je n'enregistre pas d'établissement pour nous." 
                  };
                  break;
                }
                
                // Normalize nom_canonique
                const nomCanonique = args.nom.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
                  .replace(/\s+/g, '');
                
                // Auto-map type and statut_commercial if not provided
                let finalType = args.type || 'prospect';
                let finalStatut = args.statut_commercial;
                
                // Detect from nom if type not explicit
                const nomLower = args.nom.toLowerCase();
                if (!args.type) {
                  if (nomLower.includes('client actuel')) {
                    finalType = 'client';
                    finalStatut = finalStatut || 'gagné';
                  } else if (nomLower.includes('prospect')) {
                    finalType = 'prospect';
                    finalStatut = finalStatut || 'à_contacter';
                  } else {
                    finalType = 'prospect';
                    finalStatut = finalStatut || 'à_contacter';
                  }
                } else {
                  // Apply auto-mapping based on type
                  if (finalType === 'client' && !finalStatut) {
                    finalStatut = 'gagné';
                  } else if (finalType === 'prospect' && !finalStatut) {
                    finalStatut = 'à_contacter';
                  }
                }
                
                console.log(`Creating etablissement: ${args.nom}, type=${finalType}, statut_commercial=${finalStatut}`);
                
                // Check for duplicates (nom_canonique, ville, aliases)
                const { data: existingEtabs } = await supabase
                  .from('etablissements')
                  .select('id, nom, nom_canonique, ville, type, created_at, updated_at')
                  .eq('user_id', userId)
                  .is('deleted_at', null);
                
                const foundDuplicates = existingEtabs?.filter(e => {
                  const existingNomLower = (e.nom_canonique || e.nom).toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, '');
                  return existingNomLower === nomCanonique || 
                         (args.ville && e.ville && e.ville.toLowerCase() === args.ville.toLowerCase() && 
                          existingNomLower.includes(nomCanonique.substring(0, 5)));
                }) || [];
                
                // Check aliases
                if (foundDuplicates.length === 0) {
                  const { data: aliasMatches } = await supabase
                    .from('etablissements_aliases')
                    .select('etablissement_id')
                    .ilike('alias', `%${args.nom}%`);
                  
                  if (aliasMatches && aliasMatches.length > 0) {
                    const aliasEtabIds = aliasMatches.map(a => a.etablissement_id);
                    const { data: aliasEtabs } = await supabase
                      .from('etablissements')
                      .select('id, nom, nom_canonique, ville, type, created_at, updated_at')
                      .in('id', aliasEtabIds)
                      .eq('user_id', userId)
                      .is('deleted_at', null);
                    
                    if (aliasEtabs) foundDuplicates.push(...aliasEtabs);
                  }
                }
                
                // DEDUPLICATION SILENCIEUSE (auto-merge if high confidence, else ask)
                if (foundDuplicates.length > 0) {
                  console.log(`Duplicates detected for ${args.nom}:`, foundDuplicates);
                  
                  // If only 1 duplicate and high confidence match → UPDATE existing instead of creating
                  if (foundDuplicates.length === 1) {
                    const duplicate = foundDuplicates[0];
                    console.log(`Auto-merging into existing etablissement: ${duplicate.nom}`);
                    
                    // PROMOTION prospect→client si demandé
                    let promotionApplied = false;
                    if (finalType === 'client' && duplicate.type === 'prospect') {
                      console.log({ establishment_id: duplicate.id, promotion: true });
                      promotionApplied = true;
                    }
                    
                    // Update existing with new non-null fields + promotion si applicable
                    const updateData: any = {};
                    if (promotionApplied) {
                      updateData.type = 'client';
                      updateData.statut_commercial = 'gagné';
                    }
                    if (args.nom_affiche) updateData.nom_affiche = args.nom_affiche;
                    if (args.adresse) updateData.adresse = args.adresse;
                    if (args.code_postal) updateData.code_postal = args.code_postal;
                    if (args.ville) updateData.ville = args.ville;
                    if (args.secteur) updateData.secteur = args.secteur;
                    if (args.sous_secteur) updateData.sous_secteur = args.sous_secteur;
                    if (args.statut_commercial && !promotionApplied) updateData.statut_commercial = args.statut_commercial;
                    if (args.concurrent_principal) updateData.concurrent_principal = args.concurrent_principal;
                    if (args.coefficient) updateData.coefficient = args.coefficient;
                    if (args.groupe) updateData.groupe = args.groupe;
                    if (args.notes) updateData.notes = args.notes;
                    if (args.info_libre) updateData.info_libre = args.info_libre;
                    
                    if (Object.keys(updateData).length > 0) {
                      await supabase
                        .from('etablissements')
                        .update(updateData)
                        .eq('id', duplicate.id);
                    }
                    
                    // Log merge
                    await supabase.from('historique').insert({
                      action: 'auto_deduplicate',
                      data: {
                        table_cible: 'etablissements',
                        existing_id: duplicate.id,
                        attempted_nom: args.nom,
                        action: 'updated_existing'
                      },
                      user_id: userId
                    });
                    
                    const message = promotionApplied 
                      ? `✓ ${args.nom} promu de prospect à client${duplicate.ville ? ' ('+duplicate.ville+')' : ''}`
                      : `✓ ${args.nom} mis à jour${duplicate.ville ? ' ('+duplicate.ville+')' : ''}`;
                    
                    result = { 
                      success: true, 
                      data: { id: duplicate.id, nom: duplicate.nom },
                      message
                    };
                    break;
                  }
                  
                  // Multiple duplicates → ask for clarification
                  result = { 
                    success: false, 
                    warning: 'duplicate_detected',
                    data: foundDuplicates,
                    message: `⚠️ ${foundDuplicates.length} établissement(s) similaire(s) détecté(s). Lequel garder comme maître ?`
                  };
                  break;
                }

                // No duplicates, create with minimal fields first, then update
                const minimalData = {
                  nom: args.nom,
                  nom_canonique: nomCanonique,
                  type: finalType,
                  user_id: userId
                };
                
                let etabData;
                let etabError;
                
                // Try full insert first
                try {
                  const fullData = {
                    ...minimalData,
                    nom_affiche: args.nom_affiche,
                    adresse: args.adresse,
                    code_postal: args.code_postal,
                    ville: args.ville,
                    secteur: args.secteur,
                    sous_secteur: args.sous_secteur,
                    statut_commercial: finalStatut,
                    concurrent_principal: args.concurrent_principal,
                    coefficient: args.coefficient,
                    groupe: args.groupe,
                    notes: args.notes,
                    info_libre: args.info_libre
                  };
                  
                  const { data, error } = await supabase
                    .from('etablissements')
                    .insert(fullData)
                    .select()
                    .single();
                  
                  etabData = data;
                  etabError = error;
                } catch (fullError) {
                  console.error('Full insert failed, retrying with minimal data:', fullError);
                  etabError = fullError;
                }
                
                // If full insert failed, retry with minimal data
                if (etabError) {
                  console.log('Retrying with minimal data:', minimalData);
                  const { data, error } = await supabase
                    .from('etablissements')
                    .insert(minimalData)
                    .select()
                    .single();
                  
                  if (error) {
                    console.error('Minimal insert also failed:', error);
                    throw error;
                  }
                  
                  etabData = data;
                  
                  // Now update with optional fields
                  const updateData: any = {};
                  if (args.nom_affiche) updateData.nom_affiche = args.nom_affiche;
                  if (args.adresse) updateData.adresse = args.adresse;
                  if (args.code_postal) updateData.code_postal = args.code_postal;
                  if (args.ville) updateData.ville = args.ville;
                  if (args.secteur) updateData.secteur = args.secteur;
                  if (args.sous_secteur) updateData.sous_secteur = args.sous_secteur;
                  if (finalStatut) updateData.statut_commercial = finalStatut;
                  if (args.concurrent_principal) updateData.concurrent_principal = args.concurrent_principal;
                  if (args.coefficient) updateData.coefficient = args.coefficient;
                  if (args.groupe) updateData.groupe = args.groupe;
                  if (args.notes) updateData.notes = args.notes;
                  if (args.info_libre) updateData.info_libre = args.info_libre;
                  
                  if (Object.keys(updateData).length > 0) {
                    const { data: updatedData } = await supabase
                      .from('etablissements')
                      .update(updateData)
                      .eq('id', etabData.id)
                      .select()
                      .single();
                    
                    if (updatedData) etabData = updatedData;
                  }
                }
                
                console.log('Etablissement created successfully:', etabData);
                const typeLabel = etabData.type === 'client' ? 'client' : 'prospect';
                const villeInfo = etabData.ville ? ` (${etabData.ville})` : '';
                result = { 
                  success: true, 
                  data: etabData,
                  message: `✓ ${etabData.nom} enregistré comme ${typeLabel}${villeInfo}`
                };
                
              } catch (error) {
                console.error('Error in create_etablissement:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                result = { 
                  success: false, 
                  error: `Erreur lors de la création: ${errorMessage}. Vérifiez les données et réessayez.`
                };
              }
              break;

            case 'create_contact':
              // Find etablissement first
              const { data: etabForContact } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.etablissement_nom)
                .eq('user_id', userId)
                .single();
              
              if (!etabForContact) {
                result = { success: false, error: 'Établissement non trouvé' };
                break;
              }

              const { data: contactData, error: contactError } = await supabase
                .from('contacts')
                .insert({
                  nom: args.nom,
                  prenom: args.prenom,
                  fonction: args.fonction,
                  telephone: args.telephone,
                  email: args.email,
                  preference_contact: args.preference_contact,
                  notes_contact: args.notes_contact,
                  info_libre: args.info_libre,
                  etablissement_id: etabForContact.id,
                  user_id: userId
                })
                .select()
                .single();
              
              if (contactError) throw contactError;
              result = { 
                success: true, 
                data: contactData,
                message: `✓ Contact ${contactData.prenom} ${contactData.nom} enregistré`
              };
              break;

            case 'create_action':
              try {
                // Try to find etablissement first (fuzzy-match: nom/nom_canonique/alias/ville)
                let etabForAction = null;
                const { data: foundEtab } = await supabase
                  .from('etablissements')
                  .select('id, nom')
                  .eq('user_id', userId)
                  .is('deleted_at', null)
                  .or(`nom.ilike.%${args.etablissement_nom}%,nom_canonique.ilike.%${args.etablissement_nom.toLowerCase().replace(/\s+/g, '')}%`)
                  .limit(1)
                  .single();
                
                if (foundEtab) {
                  etabForAction = foundEtab;
                } else {
                  // Fuzzy match with aliases
                  const { data: aliasMatches } = await supabase
                    .from('etablissements_aliases')
                    .select('etablissement_id')
                    .ilike('alias', `%${args.etablissement_nom}%`)
                    .limit(1);
                  
                  if (aliasMatches && aliasMatches.length > 0) {
                    const { data: etabFromAlias } = await supabase
                      .from('etablissements')
                      .select('id, nom')
                      .eq('id', aliasMatches[0].etablissement_id)
                      .eq('user_id', userId)
                      .is('deleted_at', null)
                      .single();
                    
                    if (etabFromAlias) {
                      etabForAction = etabFromAlias;
                    }
                  }
                }
                
                // If still not found, create minimal etablissement automatically
                if (!etabForAction) {
                  console.log(`Établissement "${args.etablissement_nom}" non trouvé, création minimale automatique`);
                  const nomCanonique = args.etablissement_nom.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, '');
                  
                  const { data: newEtab, error: createError } = await supabase
                    .from('etablissements')
                    .insert({
                      nom: args.etablissement_nom,
                      nom_canonique: nomCanonique,
                      type: 'prospect',
                      statut_commercial: 'à_contacter',
                      user_id: userId
                    })
                    .select('id, nom')
                    .single();
                  
                  if (createError) {
                    console.error('Error creating minimal etablissement:', createError);
                    result = { success: false, error: `Établissement "${args.etablissement_nom}" non trouvé et création impossible: ${createError.message}` };
                    break;
                  }
                  
                  etabForAction = newEtab;
                  console.log({ created_establishment_id: newEtab.id, nom: newEtab.nom });
                }

                // Find contact if provided (nullable)
                let contactId = null;
                if (args.contact_nom) {
                  const { data: contactForAction } = await supabase
                    .from('contacts')
                    .select('id')
                    .eq('etablissement_id', etabForAction.id)
                    .ilike('nom', `%${args.contact_nom}%`)
                    .limit(1)
                    .single();
                  
                  if (contactForAction) contactId = contactForAction.id;
                }

                // Handle assigne_a if provided
                let assigneAId = null;
                if (args.assigne_a_name) {
                  const { data: internalUser } = await supabase
                    .from('utilisateurs_internes')
                    .select('user_id')
                    .ilike('prenom', args.assigne_a_name)
                    .limit(1)
                    .single();
                  
                  if (internalUser) assigneAId = internalUser.user_id;
                }

                // Parse dates with French date parser (OBLIGATOIRE)
                let actionDate: Date | null = null;
                let rappelLe: string | null = null;
                
                // Parse action date (MUST be provided)
                if (args.date) {
                  actionDate = parseFrenchDate(args.date);
                  if (!actionDate) {
                    console.warn(`Date "${args.date}" invalide ou ambiguë`);
                    result = { 
                      success: false, 
                      error: `Date ambiguë : précise le jour/mois/année ou une heure pour "${args.date}"` 
                    };
                    break;
                  }
                }
                
                // CRITIQUE: Pour rappels (type='appel' avec rappel_le), date ET rappel_le identiques
                // Si commentaire contient "rappel" → c'est un rappel, donc rappel_le = date
                const isRappel = args.commentaire?.toLowerCase().includes('rappel') || 
                                 args.commentaire?.toLowerCase().includes('relancer') ||
                                 args.rappel_le;
                
                if (isRappel && args.type === 'appel') {
                  rappelLe = actionDate ? actionDate.toISOString() : new Date().toISOString();
                } else if (args.rappel_le) {
                  // Parse explicit rappel_le
                  rappelLe = parseFrenchDate(args.rappel_le)?.toISOString() || null;
                  if (!rappelLe) {
                    console.warn(`Rappel date "${args.rappel_le}" invalide, ignoré`);
                  }
                } else if (actionDate && args.type === 'visite') {
                  // Auto-set rappel_le for visites: 1h before
                  rappelLe = new Date(actionDate.getTime() - 60 * 60 * 1000).toISOString();
                }

                // Ensure date is always filled (NOT NULL)
                const finalDate = actionDate ? actionDate.toISOString() : new Date().toISOString();
                
                // Log before insert (debug)
                console.log('Inserting action:', {
                  user_id: userId,
                  etablissement_id: etabForAction.id,
                  type: args.type,
                  date: finalDate,
                  rappel_le: rappelLe
                });

                let actionData = null;
                let actionError = null;
                
                // Try insert with full data
                try {
                  const { data, error } = await supabase
                    .from('actions')
                    .insert({
                      type: args.type,
                      date: finalDate,
                      rappel_le: rappelLe,
                      commentaire: args.commentaire,
                      resultat: args.resultat,
                      contact_id: contactId,
                      assigne_a: assigneAId,
                      info_libre: args.info_libre,
                      etablissement_id: etabForAction.id,
                      user_id: userId
                    })
                    .select()
                    .single();
                  
                  actionData = data;
                  actionError = error;
                } catch (insertError) {
                  console.error('Insert action failed:', insertError);
                  actionError = insertError;
                }
                
                // RETRY: Si échec NOT NULL / RLS / FK → recréer établissement minimal + retry insert
                if (actionError) {
                  console.error('Error executing create_action, retrying with minimal etablissement:', actionError);
                  
                  // Recréer établissement minimal (au cas où il aurait été supprimé)
                  const nomCanoniqueRetry = args.etablissement_nom.toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, '');
                  
                  const { data: retryEtab } = await supabase
                    .from('etablissements')
                    .insert({
                      nom: args.etablissement_nom,
                      nom_canonique: nomCanoniqueRetry,
                      type: 'prospect',
                      statut_commercial: 'à_contacter',
                      user_id: userId
                    })
                    .select('id, nom')
                    .single();
                  
                  if (retryEtab) {
                    console.log({ created_establishment_id: retryEtab.id, nom: retryEtab.nom });
                    
                    // Retry insert action avec nouvel établissement
                    const { data: retryActionData, error: retryActionError } = await supabase
                      .from('actions')
                      .insert({
                        type: args.type,
                        date: finalDate,
                        rappel_le: rappelLe,
                        commentaire: args.commentaire,
                        resultat: args.resultat,
                        contact_id: contactId,
                        assigne_a: assigneAId,
                        info_libre: args.info_libre,
                        etablissement_id: retryEtab.id,
                        user_id: userId
                      })
                      .select()
                      .single();
                    
                    if (retryActionError) {
                      console.error('Retry insert action also failed:', retryActionError);
                      throw retryActionError;
                    }
                    
                    actionData = retryActionData;
                  } else {
                    throw actionError;
                  }
                }
                
                // Confirmation message pour l'utilisateur
                const isRappelConfirm = rappelLe && args.type === 'appel';
                const typeLabel = isRappelConfirm ? 'Rappel' : 
                                  args.type === 'visite' ? 'Visite' : 
                                  args.type === 'mail' ? 'Email' : 
                                  'Action';
                const dateFormatted = actionDate ? 
                  new Date(actionDate).toLocaleDateString('fr-FR', { 
                    day: 'numeric', 
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 
                  'aujourd\'hui';
                const commentInfo = args.commentaire ? ` : ${args.commentaire}` : '';
                
                result = { 
                  success: true, 
                  data: actionData,
                  message: `✓ ${typeLabel} enregistré pour ${dateFormatted}${commentInfo} (${etabForAction.nom})`
                };
              } catch (error) {
                console.error('Error in create_action:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                result = { 
                  success: false, 
                  error: `Erreur lors de la création de l'action: ${errorMessage}`
                };
              }
              break;

            case 'search_etablissements':
              let query = supabase
                .from('etablissements')
                .select('*')
                .eq('user_id', userId);
              
              if (args.nom) query = query.ilike('nom', `%${args.nom}%`);
              if (args.type) query = query.eq('type', args.type);
              if (args.secteur) query = query.ilike('secteur', `%${args.secteur}%`);
              
              const { data: etablissements, error: searchError } = await query;
              if (searchError) throw searchError;
              result = { success: true, data: etablissements };
              break;

            case 'search_actions':
              let actionQuery = supabase
                .from('actions')
                .select('*, etablissements(nom)')
                .eq('user_id', userId);
              
              if (args.type) actionQuery = actionQuery.eq('type', args.type);
              if (args.date_debut) actionQuery = actionQuery.gte('date', args.date_debut);
              if (args.date_fin) actionQuery = actionQuery.lte('date', args.date_fin);
              
              if (args.etablissement_nom) {
                const { data: etab } = await supabase
                  .from('etablissements')
                  .select('id')
                  .eq('nom', args.etablissement_nom)
                  .eq('user_id', userId)
                  .single();
                
                if (etab) {
                  actionQuery = actionQuery.eq('etablissement_id', etab.id);
                }
              }
              
              const { data: actions, error: actionsError } = await actionQuery;
              if (actionsError) throw actionsError;
              result = { success: true, data: actions };
              break;

            case 'get_etablissement_info':
              const { data: etabInfo, error: etabInfoError } = await supabase
                .from('etablissements')
                .select('*, contacts(*), actions(*), concurrence(*)')
                .eq('nom', args.nom)
                .eq('user_id', userId)
                .single();
              
              if (etabInfoError) throw etabInfoError;
              result = { success: true, data: etabInfo };
              break;

            case 'search_internal_users':
              let userQuery = supabase
                .from('utilisateurs_internes')
                .select('*');
              
              if (args.prenom) userQuery = userQuery.ilike('prenom', `%${args.prenom}%`);
              if (args.nom) userQuery = userQuery.ilike('nom', `%${args.nom}%`);
              
              const { data: internalUsers, error: usersError } = await userQuery;
              if (usersError) throw usersError;
              result = { success: true, data: internalUsers };
              break;

            case 'create_internal_user':
              const { data: newUser, error: newUserError } = await supabase
                .from('utilisateurs_internes')
                .insert({
                  nom: args.nom,
                  prenom: args.prenom,
                  email: args.email,
                  role: args.role,
                  user_id: userId
                })
                .select()
                .single();
              
              if (newUserError) throw newUserError;
              result = { success: true, data: newUser };
              break;

            case 'detect_duplicates':
              const nomLower = args.nom.toLowerCase().replace(/\s+/g, '');
              
              const { data: allEtabs } = await supabase
                .from('etablissements')
                .select('*')
                .eq('user_id', userId)
                .is('deleted_at', null);
              
              const duplicates = allEtabs?.filter(e => 
                e.nom.toLowerCase().replace(/\s+/g, '').includes(nomLower) ||
                nomLower.includes(e.nom.toLowerCase().replace(/\s+/g, ''))
              ) || [];
              
              result = { 
                success: true, 
                data: duplicates,
                message: duplicates.length > 0 
                  ? `${duplicates.length} doublon(s) détecté(s)` 
                  : 'Aucun doublon détecté'
              };
              break;

            case 'merge_etablissements':
              // Find both establishments
              const { data: maitreEtab } = await supabase
                .from('etablissements')
                .select('*')
                .eq('nom', args.nom_maitre)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              const { data: doublonEtab } = await supabase
                .from('etablissements')
                .select('*')
                .eq('nom', args.nom_doublon)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!maitreEtab || !doublonEtab) {
                result = { success: false, error: 'Un ou plusieurs établissements non trouvés' };
                break;
              }

              // Merge non-empty fields from doublon to maitre
              const mergedData: any = { ...maitreEtab };
              if (!mergedData.adresse && doublonEtab.adresse) mergedData.adresse = doublonEtab.adresse;
              if (!mergedData.secteur && doublonEtab.secteur) mergedData.secteur = doublonEtab.secteur;
              if (!mergedData.statut && doublonEtab.statut) mergedData.statut = doublonEtab.statut;
              if (!mergedData.notes && doublonEtab.notes) mergedData.notes = doublonEtab.notes;

              // Update maitre with merged data
              await supabase
                .from('etablissements')
                .update(mergedData)
                .eq('id', maitreEtab.id);

              // Repoint all relations from doublon to maitre
              await supabase
                .from('contacts')
                .update({ etablissement_id: maitreEtab.id })
                .eq('etablissement_id', doublonEtab.id);
              
              await supabase
                .from('actions')
                .update({ etablissement_id: maitreEtab.id })
                .eq('etablissement_id', doublonEtab.id);
              
              await supabase
                .from('concurrence')
                .update({ etablissement_id: maitreEtab.id })
                .eq('etablissement_id', doublonEtab.id);

              // Soft delete the doublon
              await supabase
                .from('etablissements')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', doublonEtab.id);

              // Log merge in historique
              await supabase.from('historique').insert({
                action: 'merge',
                data: {
                  table_cible: 'etablissements',
                  maitre_id: maitreEtab.id,
                  doublon_id: doublonEtab.id,
                  nom_maitre: args.nom_maitre,
                  nom_doublon: args.nom_doublon
                },
                user_id: userId
              });

              result = { 
                success: true, 
                message: `Fusion réussie : ${args.nom_doublon} fusionné dans ${args.nom_maitre}`
              };
              break;

            case 'soft_delete_etablissement':
              const { data: etabToDelete } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.nom)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!etabToDelete) {
                result = { success: false, error: 'Établissement non trouvé ou déjà supprimé' };
                break;
              }

              await supabase
                .from('etablissements')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', etabToDelete.id);

              // Log deletion
              await supabase.from('historique').insert({
                action: 'delete',
                data: {
                  table_cible: 'etablissements',
                  etablissement_id: etabToDelete.id,
                  nom: args.nom
                },
                user_id: userId
              });

              result = { 
                success: true, 
                message: `Établissement "${args.nom}" supprimé (soft delete)`
              };
              break;

            case 'move_contacts':
              const { data: sourceEtab } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.nom_source)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              const { data: destEtab } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.nom_destination)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!sourceEtab || !destEtab) {
                result = { success: false, error: 'Un ou plusieurs établissements non trouvés' };
                break;
              }

              const { data: movedContacts } = await supabase
                .from('contacts')
                .update({ etablissement_id: destEtab.id })
                .eq('etablissement_id', sourceEtab.id)
                .select();

              result = { 
                success: true, 
                data: movedContacts,
                message: `${movedContacts?.length || 0} contact(s) déplacé(s) de ${args.nom_source} vers ${args.nom_destination}`
              };
              break;

            case 'manage_concurrence':
              const { data: etabConcurrence } = await supabase
                .from('etablissements')
                .select('id, secteur')
                .eq('nom', args.etablissement_nom)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!etabConcurrence) {
                result = { success: false, error: 'Établissement non trouvé' };
                break;
              }

              // Si secteur absent, hériter du secteur de l'établissement
              const finalSecteur = args.secteur || etabConcurrence.secteur || null;

              const { data: concurrenceData, error: concurrenceError } = await supabase
                .from('concurrence')
                .insert({
                  etablissement_id: etabConcurrence.id,
                  user_id: userId,
                  concurrent_principal: args.concurrent_principal,
                  postes: args.postes,
                  secteur: finalSecteur,
                  sous_secteur: args.sous_secteur,
                  coefficient_observe: args.coefficient_observe,
                  statut: args.statut || 'actif',
                  date_debut: args.date_debut,
                  date_fin: args.date_fin,
                  remarques: args.remarques
                })
                .select()
                .single();
              
              if (concurrenceError) throw concurrenceError;
              result = { success: true, data: concurrenceData };
              break;

            case 'query_concurrence':
              let concQuery = supabase
                .from('concurrence')
                .select('*, etablissements(nom, ville)')
                .eq('user_id', userId)
                .is('deleted_at', null);
              
              if (args.concurrent) concQuery = concQuery.ilike('concurrent_principal', `%${args.concurrent}%`);
              if (args.poste) concQuery = concQuery.contains('postes', [args.poste]);
              
              // Normalisation secteur: "hôtellerie restauration", "hôtellerie-restauration", "HR" → hôtellerie + restauration
              let secteurFilters: string[] = [];
              if (args.secteur) {
                const secteurLower = args.secteur.toLowerCase().replace(/[-\s]/g, '');
                if (secteurLower.includes('hr') || secteurLower.includes('hotellerierestau')) {
                  secteurFilters = ['hôtellerie', 'restauration', 'hôtellerie-restauration'];
                } else {
                  secteurFilters = [args.secteur];
                }
              }
              
              const { data: concurrenceResults, error: concQueryError } = await concQuery;
              if (concQueryError) throw concQueryError;
              
              // Filter by secteur if needed (OR logic for normalized sectors)
              let filteredResults = concurrenceResults || [];
              if (secteurFilters.length > 0) {
                filteredResults = filteredResults.filter(c => 
                  c.secteur && secteurFilters.some(sf => 
                    c.secteur.toLowerCase().includes(sf.toLowerCase())
                  )
                );
              }
              
              // Aggregate by concurrent_principal (Top 3 ou Top 10 si list_all)
              type AggregatedConcurrent = { concurrent: string; count: number; coef_total: number };
              const aggregated = filteredResults.reduce((acc, curr) => {
                const concurrent = curr.concurrent_principal || 'Inconnu';
                if (!acc[concurrent]) {
                  acc[concurrent] = { concurrent, count: 0, coef_total: 0 };
                }
                acc[concurrent].count += 1;
                acc[concurrent].coef_total += curr.coefficient_observe || 0;
                return acc;
              }, {} as Record<string, AggregatedConcurrent>);
              
              const topLimit = args.list_all ? 10 : 3;
              const topConcurrents = (Object.values(aggregated) as AggregatedConcurrent[])
                .sort((a, b) => b.count - a.count)
                .slice(0, topLimit)
                .map(c => ({
                  concurrent: c.concurrent,
                  presence: c.count,
                  coef_moyen: c.count > 0 ? (c.coef_total / c.count).toFixed(3) : null
                }));
              
              result = { 
                success: true, 
                data: filteredResults,
                summary: {
                  total: filteredResults.length,
                  top_concurrents: topConcurrents,
                  coef_moyen: filteredResults.length ? 
                    (filteredResults.reduce((acc, c) => acc + (c.coefficient_observe || 0), 0) / filteredResults.length).toFixed(3) : 
                    null
                }
              };
              break;

            case 'search_rappels':
              let rappelQuery = supabase
                .from('actions')
                .select('*, etablissements(nom, ville)')
                .eq('user_id', userId)
                .eq('type', 'appel')
                .not('rappel_le', 'is', null)
                .is('deleted_at', null)
                .order('rappel_le', { ascending: true });
              
              // Filtrage par période
              if (args.date_debut) rappelQuery = rappelQuery.gte('rappel_le', args.date_debut);
              if (args.date_fin) rappelQuery = rappelQuery.lte('rappel_le', args.date_fin);
              
              if (args.periode) {
                const now = new Date();
                let dateDebut: Date;
                let dateFin: Date = new Date(now);
                dateFin.setDate(dateFin.getDate() + 365); // fin lointaine
                
                switch (args.periode) {
                  case 'today':
                    dateDebut = new Date(now.setHours(0, 0, 0, 0));
                    dateFin = new Date(now.setHours(23, 59, 59, 999));
                    break;
                  case 'semaine':
                    dateDebut = new Date(now);
                    dateFin.setDate(now.getDate() + 7);
                    break;
                  case 'mois':
                    dateDebut = new Date(now);
                    dateFin.setDate(now.getDate() + 30);
                    break;
                  default:
                    dateDebut = new Date(now);
                }
                
                rappelQuery = rappelQuery
                  .gte('rappel_le', dateDebut.toISOString())
                  .lte('rappel_le', dateFin.toISOString());
              }
              
              const { data: rappels, error: rappelsError } = await rappelQuery;
              if (rappelsError) throw rappelsError;
              
              result = { 
                success: true, 
                data: rappels,
                message: `${rappels?.length || 0} rappel(s) trouvé(s)`
              };
              break;

            case 'search_actions_en_cours':
              const daysBack = args.days || 30;
              const dateLimit = new Date();
              dateLimit.setDate(dateLimit.getDate() - daysBack);
              
              const { data: actionsEnCours, error: actionsEnCoursError } = await supabase
                .from('actions')
                .select('*, etablissements(nom, ville)')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .gte('date', dateLimit.toISOString())
                .order('date', { ascending: false });
              
              if (actionsEnCoursError) throw actionsEnCoursError;
              
              result = { 
                success: true, 
                data: actionsEnCours,
                message: `${actionsEnCours?.length || 0} action(s) commerciale(s) en cours (${daysBack} derniers jours)`
              };
              break;

            case 'create_alias':
              // Blacklist ADAPTEL
              const aliasLowerAdaptel = args.alias.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (aliasLowerAdaptel.includes('adaptel')) {
                result = { 
                  success: false, 
                  error: "Ne pas créer d'alias pour ADAPTEL" 
                };
                break;
              }

              // Check if alias already exists
              const { data: existingAlias } = await supabase
                .from('etablissements_aliases')
                .select('id')
                .eq('etablissement_id', args.etablissement_id)
                .eq('alias', args.alias)
                .single();
              
              if (existingAlias) {
                result = { success: true, message: "Alias déjà existant (skip)" };
                break;
              }

              const { data: aliasData, error: aliasError } = await supabase
                .from('etablissements_aliases')
                .insert({
                  etablissement_id: args.etablissement_id,
                  alias: args.alias
                })
                .select()
                .single();
              
              if (aliasError) {
                console.warn('Error creating alias:', aliasError);
                result = { success: false, error: aliasError.message };
              } else {
                result = { success: true, data: aliasData };
              }
              break;

            default:
              result = { success: false, error: 'Fonction inconnue' };
          }
        } catch (error) {
          console.error(`Error executing ${functionName}:`, error);
          result = { success: false, error: error instanceof Error ? error.message : 'Une erreur est survenue' };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        });

        // Save to historique
        await supabase.from('historique').insert({
          action: `${functionName}: ${JSON.stringify(args)}`,
          data: result,
          user_id: userId
        });
      }

      // Return tool results for the assistant to formulate final response
      return new Response(
        JSON.stringify({ 
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls,
          tool_results: toolResults
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // No tool calls, return the message directly
    return new Response(
      JSON.stringify({ 
        content: assistantMessage.content,
        tool_calls: null,
        tool_results: null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in ai-crm-chat function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Une erreur est survenue' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});