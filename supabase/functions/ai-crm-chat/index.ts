import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Tu es un assistant commercial intelligent pour ADAPTEL Lyon, une agence d'intérim.

Tu as une MÉMOIRE CONVERSATIONNELLE : tu te souviens du contexte des échanges précédents dans la conversation.

**ACTIONS DISPONIBLES:**

1. AJOUTER un établissement, contact, action ou concurrence
2. RECHERCHER/CONSULTER des informations
3. ANALYSER les données (rappels, contacts manquants, etc.)
4. ASSIGNER des tâches/rappels à des collaborateurs internes
5. FUSIONNER des établissements doublons
6. SUPPRIMER (soft delete) des établissements/contacts
7. DÉTECTER automatiquement les doublons lors des créations

**RÈGLES IMPORTANTES:**

1. **MÉMOIRE ET CONTEXTE:**
   - Garde en mémoire les établissements, contacts et actions mentionnés dans la conversation
   - Si l'utilisateur dit "Appelle le directeur mardi", comprends qu'il parle du dernier établissement/contact mentionné
   - Ne redemande pas des infos déjà données dans la conversation récente

2. **DATES NATURELLES:**
   - Comprends "demain", "lundi prochain", "dans 3 jours", "la semaine prochaine"
   - Date du jour : ${new Date().toISOString()}
   - Calcule automatiquement les dates exactes au format ISO 8601

3. **ASSIGNATION DE TÂCHES:**
   - Quand on dit "Dis à [prénom] de...", cherche d'abord l'utilisateur interne correspondant
   - Si plusieurs prénoms similaires, demande confirmation ("Tu veux dire Céline M. ?")
   - Assigne l'action avec assigned_to

4. **REFORMULATION ET CONFIRMATION:**
   - Pour les infos ambiguës ou incomplètes, reformule avant d'enregistrer
   - Exemples : "Tu veux dire le Novotel de Bron ou de Part-Dieu ?", "C'est pour Céline Martin du service commercial ?"

5. **EXTRACTION D'INFOS:**
   - Établissements : nom, adresse, type (client/prospect), secteur, statut
   - Contacts : nom, prénom, fonction, téléphone, email
   - Actions : type (appel/visite/mail/autre), date, commentaire, résultat, assigned_to
   - Utilisateurs internes : prénom, nom

6. **GESTION DES DOUBLONS:**
   - Avant de créer un établissement, vérifie automatiquement s'il existe déjà (même nom, même adresse ou ville)
   - Si un doublon est détecté, propose à l'utilisateur de fusionner ou annuler
   - Pour fusionner des doublons : garde l'établissement avec le plus de données, repointe les relations
   - Les suppressions sont toujours "soft delete" (marquées comme supprimées, jamais effacées)
   - Commandes acceptées : "Fusionne [A] avec [B]", "Supprime [X]", "Liste les doublons", "Déplace les contacts de [A] vers [B]"

7. **COMMUNICATION:**
   - Réponds de manière naturelle et professionnelle
   - Confirme les actions effectuées
   - Reformule pour clarifier si nécessaire
   - Alerte en cas de doublon détecté

**EXEMPLES:**

"J'ai rencontré le directeur du Novotel Bron hier" 
→ Créer établissement + contact + action visite

"Rappeler dans 10 jours"
→ Créer action avec date calculée automatiquement

"Dis à Céline d'appeler le Sofitel demain"
→ Chercher Céline dans utilisateurs_internes + créer action assignée

"Quels sont mes rappels cette semaine ?"
→ Rechercher actions avec dates de cette semaine

"Fusionne les doublons de Novotel"
→ Détecter les doublons + proposer fusion

"Supprime le doublon Pullman Lyon"
→ Soft delete de l'établissement

Utilise ta mémoire conversationnelle et les outils disponibles intelligemment.`;

// Tools definition for structured output
const tools = [
  {
    type: "function",
    function: {
      name: "create_etablissement",
      description: "Créer un nouvel établissement",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de l'établissement" },
          adresse: { type: "string", description: "Adresse de l'établissement" },
          type: { 
            type: "string", 
            enum: ["client", "prospect"],
            description: "Type d'établissement"
          },
          secteur: { type: "string", description: "Secteur d'activité" },
          statut: { type: "string", description: "Statut actuel" },
          notes: { type: "string", description: "Notes diverses" }
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
          email: { type: "string", description: "Email du contact" }
        },
        required: ["etablissement_nom", "nom", "prenom"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_action",
      description: "Créer une action commerciale ou un rappel",
      parameters: {
        type: "object",
        properties: {
          etablissement_nom: { type: "string", description: "Nom de l'établissement" },
          type: { 
            type: "string", 
            enum: ["appel", "visite", "mail", "autre"],
            description: "Type d'action"
          },
          date: { type: "string", description: "Date de l'action au format ISO 8601" },
          commentaire: { type: "string", description: "Commentaire sur l'action" },
          resultat: { type: "string", description: "Résultat de l'action" },
          assigned_to_name: { type: "string", description: "Prénom du collaborateur interne à qui assigner la tâche (optionnel)" }
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
              // Check for duplicates first
              const createNomLower = args.nom.toLowerCase().replace(/\s+/g, '');
              
              const { data: existingEtabs } = await supabase
                .from('etablissements')
                .select('*')
                .eq('user_id', userId)
                .is('deleted_at', null);
              
              const foundDuplicates = existingEtabs?.filter(e => {
                const existingNomLower = e.nom.toLowerCase().replace(/\s+/g, '');
                return existingNomLower === createNomLower || 
                       (e.adresse && args.adresse && e.adresse.toLowerCase().includes(args.adresse.toLowerCase()));
              }) || [];
              
              if (foundDuplicates.length > 0) {
                result = { 
                  success: false, 
                  warning: 'duplicate_detected',
                  data: foundDuplicates,
                  message: `⚠️ Attention : Il existe déjà ${foundDuplicates.length} établissement(s) similaire(s). Souhaitez-vous fusionner ou annuler la création ?`
                };
                break;
              }

              // No duplicates, proceed with creation
              const { data: etabData, error: etabError } = await supabase
                .from('etablissements')
                .insert({
                  nom: args.nom,
                  adresse: args.adresse,
                  type: args.type,
                  secteur: args.secteur,
                  statut: args.statut,
                  notes: args.notes,
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

              // Handle assigned_to if provided (by internal user name)
              let assignedToId = null;
              if (args.assigned_to_name) {
                const { data: internalUser } = await supabase
                  .from('utilisateurs_internes')
                  .select('id')
                  .ilike('prenom', args.assigned_to_name)
                  .limit(1)
                  .single();
                
                if (internalUser) {
                  assignedToId = internalUser.id;
                }
              }

              const { data: actionData, error: actionError } = await supabase
                .from('actions')
                .insert({
                  type: args.type,
                  date: args.date,
                  commentaire: args.commentaire,
                  resultat: args.resultat,
                  etablissement_id: etabForAction.id,
                  assigned_to: assignedToId,
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