import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Tu es un assistant commercial intelligent pour ADAPTEL Lyon, une agence d'intérim.

Tu dois comprendre les demandes en langage naturel et effectuer les actions suivantes :

**ACTIONS DISPONIBLES:**

1. AJOUTER un établissement, contact, action ou concurrence
2. RECHERCHER/CONSULTER des informations
3. ANALYSER les données (rappels, contacts manquants, etc.)

**RÈGLES IMPORTANTES:**
- Extrais les informations importantes des phrases
- Pour les établissements : nom, adresse, type (client/prospect), secteur, statut
- Pour les contacts : nom, prénom, fonction, téléphone, email
- Pour les actions : type (appel/visite/mail/autre), date, commentaire, résultat
- Pour les dates de rappel : calcule la date exacte
- Réponds toujours en français de manière professionnelle et concise
- Confirme les actions effectuées

**EXEMPLES:**
"J'ai rencontré le directeur du Novotel Bron hier" 
→ Créer établissement Novotel Bron (prospect) + contact directeur + action visite

"Rappeler dans 10 jours"
→ Créer une action de type rappel avec la date calculée

"Quels sont mes rappels de cette semaine?"
→ Rechercher les actions de cette semaine

Utilise les outils disponibles pour effectuer les actions demandées.`;

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
          resultat: { type: "string", description: "Résultat de l'action" }
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

              const { data: actionData, error: actionError } = await supabase
                .from('actions')
                .insert({
                  type: args.type,
                  date: args.date,
                  commentaire: args.commentaire,
                  resultat: args.resultat,
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