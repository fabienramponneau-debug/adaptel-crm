import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Tu es l'assistant IA du CRM ADAPTEL Lyon (agence de travail temporaire spécialisée en Hôtellerie/Restauration).

MAPPING AUTOMATIQUE (zéro friction) :
- "Client actuel Novotel Bron, coef 2.048, groupe ACCOR" → champs dédiés (coefficient, groupe, ville)
- "Prospect Hôtel Y cherche cuisiniers" → info_libre={postes:['cuisine']}
- "RDV demain 15h" → action + rappel_le automatique (1h avant si RDV, jour J 9h si tâche)
- Tout hors schéma → info_libre jsonb

SECTEURS : hôtellerie, restauration, hôtellerie-restauration, restauration_collective
SOUS-SECTEURS : hôtel_1..5_étoiles, EHPAD, crèche, scolaire, résidence_hôtelière, etc.

DÉDUPLICATION INTELLIGENTE :
- Vérifier nom_canonique + ville + aliases avant création
- Si doublon SANS consigne : garder fiche avec + contacts/actions, sinon + récente
- Fusion auto : re-router contacts/actions, soft delete doublon, log historique
- "Fusionne X avec Y" : garde X comme maître

CONCURRENCE : postes[], secteur, coefficient_observe, statut (actif/historique/pressenti)
RAPPELS : rappel_le automatique (RDV: 1h avant, tâche: jour J 9h)
ASSIGNATIONS : "Dis à Céline..." → assigne_a
SUPPRESSION : toujours soft delete (deleted_at)

Date du jour : ${new Date().toISOString()}
Réponds en français de façon naturelle.`;

// Tools definition for structured output
const tools = [
  {
    type: "function",
    function: {
      name: "create_etablissement",
      description: "Créer un nouvel établissement (champs métier hôtellerie/restauration)",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement" },
          nom_affiche: { type: "string", description: "Nom d'affichage (optionnel)" },
          adresse: { type: "string", description: "Adresse de l'établissement" },
          code_postal: { type: "string", description: "Code postal" },
          ville: { type: "string", description: "Ville" },
          type: { 
            type: "string", 
            enum: ["client_actuel", "prospect", "ancien_client"],
            description: "Type d'établissement"
          },
          secteur: { type: "string", description: "Secteur: hôtellerie/restauration/hôtellerie-restauration/restauration_collective" },
          sous_secteur: { type: "string", description: "Sous-secteur: hôtel_1..5_étoiles, EHPAD, crèche, scolaire, etc." },
          statut_commercial: { type: "string", description: "Statut commercial" },
          concurrent_principal: { type: "string", description: "Concurrent principal" },
          coefficient: { type: "number", description: "Coefficient (ex: 2.048)" },
          groupe: { type: "string", description: "Groupe (ex: ACCOR)" },
          notes: { type: "string", description: "Notes diverses" },
          info_libre: { type: "object", description: "Données hors schéma (jsonb)" }
        },
        required: ["nom", "type"]
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
      description: "Créer une action commerciale ou un rappel (avec rappel_le auto si RDV/tâche)",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          contact_nom: { type: "string", description: "Nom du contact lié (optionnel)" },
          type: { 
            type: "string", 
            enum: ["appel", "visite", "mail", "rdv", "tache", "autre"],
            description: "Type d'action"
          },
          date: { type: "string", description: "Date de l'action au format ISO 8601" },
          rappel_le: { type: "string", description: "Date du rappel (auto: RDV=1h avant, tâche=jour J 9h)" },
          commentaire: { type: "string", description: "Commentaire sur l'action" },
          resultat: { type: "string", description: "Résultat de l'action" },
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
      description: "Rechercher des actions/rappels selon des critères",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          type: { 
            type: "string", 
            enum: ["appel", "visite", "mail", "autre"],
            description: "Type d'action"
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
      description: "Interroger la concurrence (concurrent le plus présent, coef moyen, etc.)",
      parameters: {
        type: "object",
        properties: {
          concurrent: { type: "string", description: "Nom du concurrent à analyser" },
          poste: { type: "string", description: "Poste à filtrer" },
          secteur: { type: "string", description: "Secteur à filtrer" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_alias",
      description: "Ajouter un alias pour un établissement (variantes de nom)",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          alias: { type: "string", description: "Alias (variante du nom)" }
        },
        required: ["etablissement_nom", "alias"]
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
            case 'create_etablissement':
              // Normalize nom_canonique
              const nomCanonique = args.nom.toLowerCase().replace(/\s+/g, '');
              
              // Check for duplicates (nom_canonique, ville, aliases)
              const { data: existingEtabs } = await supabase
                .from('etablissements')
                .select('*')
                .eq('user_id', userId)
                .is('deleted_at', null);
              
              const foundDuplicates = existingEtabs?.filter(e => {
                const existingNomLower = (e.nom_canonique || e.nom).toLowerCase().replace(/\s+/g, '');
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
                    .select('*')
                    .in('id', aliasEtabIds)
                    .eq('user_id', userId)
                    .is('deleted_at', null);
                  
                  if (aliasEtabs) foundDuplicates.push(...aliasEtabs);
                }
              }
              
              if (foundDuplicates.length > 0) {
                result = { 
                  success: false, 
                  warning: 'duplicate_detected',
                  data: foundDuplicates,
                  message: `⚠️ Doublon détecté: ${foundDuplicates.length} établissement(s) similaire(s). Fusionner ou annuler ?`
                };
                break;
              }

              // No duplicates, create with full fields
              const { data: etabData, error: etabError } = await supabase
                .from('etablissements')
                .insert({
                  nom: args.nom,
                  nom_affiche: args.nom_affiche,
                  nom_canonique: nomCanonique,
                  adresse: args.adresse,
                  code_postal: args.code_postal,
                  ville: args.ville,
                  type: args.type,
                  secteur: args.secteur,
                  sous_secteur: args.sous_secteur,
                  statut_commercial: args.statut_commercial,
                  concurrent_principal: args.concurrent_principal,
                  coefficient: args.coefficient,
                  groupe: args.groupe,
                  notes: args.notes,
                  info_libre: args.info_libre,
                  user_id: userId
                })
                .select()
                .single();
              
              if (etabError) throw etabError;
              result = { success: true, data: etabData };
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
              result = { success: true, data: contactData };
              break;

            case 'create_action':
              const { data: etabForAction } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.etablissement_nom)
                .eq('user_id', userId)
                .single();
              
              if (!etabForAction) {
                result = { success: false, error: 'Établissement non trouvé' };
                break;
              }

              // Find contact if provided
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

              // Auto-set rappel_le if not provided
              let rappelLe = args.rappel_le;
              if (!rappelLe && (args.type === 'rdv' || args.type === 'tache')) {
                const actionDate = new Date(args.date);
                if (args.type === 'rdv') {
                  // 1h before
                  rappelLe = new Date(actionDate.getTime() - 60 * 60 * 1000).toISOString();
                } else {
                  // Same day at 9am
                  const rappelDate = new Date(actionDate);
                  rappelDate.setHours(9, 0, 0, 0);
                  rappelLe = rappelDate.toISOString();
                }
              }

              const { data: actionData, error: actionError } = await supabase
                .from('actions')
                .insert({
                  type: args.type,
                  date: args.date,
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
              
              if (actionError) throw actionError;
              result = { success: true, data: actionData };
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
                .select('id')
                .eq('nom', args.etablissement_nom)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!etabConcurrence) {
                result = { success: false, error: 'Établissement non trouvé' };
                break;
              }

              const { data: concurrenceData, error: concurrenceError } = await supabase
                .from('concurrence')
                .insert({
                  etablissement_id: etabConcurrence.id,
                  user_id: userId,
                  concurrent_principal: args.concurrent_principal,
                  postes: args.postes,
                  secteur: args.secteur,
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
              if (args.secteur) concQuery = concQuery.eq('secteur', args.secteur);
              if (args.poste) concQuery = concQuery.contains('postes', [args.poste]);
              
              const { data: concurrenceResults, error: concQueryError } = await concQuery;
              if (concQueryError) throw concQueryError;
              
              result = { 
                success: true, 
                data: concurrenceResults,
                summary: {
                  total: concurrenceResults?.length || 0,
                  coef_moyen: concurrenceResults?.length ? 
                    (concurrenceResults.reduce((acc, c) => acc + (c.coefficient_observe || 0), 0) / concurrenceResults.length).toFixed(3) : 
                    null
                }
              };
              break;

            case 'create_alias':
              const { data: etabAlias } = await supabase
                .from('etablissements')
                .select('id')
                .eq('nom', args.etablissement_nom)
                .eq('user_id', userId)
                .is('deleted_at', null)
                .single();
              
              if (!etabAlias) {
                result = { success: false, error: 'Établissement non trouvé' };
                break;
              }

              const { data: aliasData, error: aliasError } = await supabase
                .from('etablissements_aliases')
                .insert({
                  etablissement_id: etabAlias.id,
                  alias: args.alias
                })
                .select()
                .single();
              
              if (aliasError) throw aliasError;
              result = { success: true, data: aliasData, message: `Alias "${args.alias}" ajouté` };
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