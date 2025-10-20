# CRM ADAPTEL - Documentation Hôtellerie/Restauration

## Vue d'ensemble

Cette documentation décrit les améliorations apportées au CRM ADAPTEL pour le secteur Hôtellerie/Restauration, avec un focus sur la déduplication intelligente, les rappels, et la gestion de la concurrence.

## 🗄️ Schéma de base de données

### Nouveaux champs ajoutés

#### Table `etablissements`
- `nom_affiche` (text) : Nom d'affichage tel que donné par l'utilisateur
- `nom_canonique` (text) : Version normalisée (minuscules, espaces unifiés) pour la déduplication
- `code_postal` (text) : Code postal de l'établissement
- `ville` (text) : Ville de l'établissement
- `sous_secteur` (text) : Classification fine (ex: EHPAD, hôtel_3_étoiles, restaurant_gastronomique)
- `statut_commercial` (text) : État commercial (prospect, client_actuel, ancien_client)
- `concurrent_principal` (text) : Agence concurrente principale
- `coefficient` (numeric(6,3)) : Coefficient commercial
- `groupe` (text) : Groupe hôtelier/restauration (ex: ACCOR, SODEXO)
- `info_libre` (jsonb) : Données métier non structurées

#### Nouvelle table `etablissements_aliases`
Table dédiée aux variantes de noms d'établissements :
- `id` (uuid, PK)
- `etablissement_id` (uuid, FK vers etablissements)
- `alias` (text) : Variante du nom
- `created_at` (timestamp)

#### Table `contacts`
- `preference_contact` (text) : Préférence de contact (email, telephone, en_personne)
- `notes_contact` (text) : Notes spécifiques sur le contact
- `info_libre` (jsonb) : Données complémentaires

#### Table `actions`
- `contact_id` (uuid, FK optionnel) : Contact lié à l'action
- `rappel_le` (timestamp) : Date/heure du rappel
- `assigne_a` (uuid, FK vers utilisateurs_internes) : Utilisateur assigné
- `info_libre` (jsonb) : Données complémentaires

#### Table `concurrence` (enrichie)
- `postes` (text[]) : Liste des postes concernés (cuisine, service, etc.)
- `secteur` (text) : Secteur d'activité
- `sous_secteur` (text) : Sous-secteur spécifique
- `coefficient_observe` (numeric(6,3)) : Coefficient observé chez le concurrent
- `statut` (text) : actif, historique, pressenti
- `date_debut` (timestamp) : Date de début de la relation
- `date_fin` (timestamp) : Date de fin de la relation
- `deleted_at` (timestamp) : Soft delete

### Index créés

Optimisation pour les recherches de doublons et performances :
- `idx_etablissements_nom_canonique_lower` : Recherche normalisée sur nom_canonique
- `idx_etablissements_active` : Index composite (user_id, nom_canonique, ville)
- `idx_etablissements_location` : Index sur (code_postal, ville)
- `idx_actions_rappel_le` : Index sur les rappels à venir
- `idx_actions_assigne_a` : Index sur les actions assignées
- `idx_actions_contact_id` : Index sur les actions liées à un contact
- `idx_concurrence_statut` : Index sur le statut de la concurrence
- `idx_etablissements_aliases_normalized` : Recherche normalisée sur les alias

## 🤖 Comportements de l'agent IA

### 1. Mapping automatique (zéro friction)

L'agent comprend et mappe automatiquement les informations métier :

**Exemples :**
- "Client actuel Novotel Bron, coef 2.048, groupe ACCOR"
  → `type=client_actuel`, `nom=Novotel Bron`, `coefficient=2.048`, `groupe=ACCOR`, `ville=Bron`

- "Prospect Hôtel Y cherche cuisiniers"
  → `type=prospect`, `info_libre={postes:['cuisine']}`

- "RDV demain 15h avec M. X au restaurant Y"
  → Crée une action `type=rdv`, `rappel_le=1h avant`, lie le contact si existe

### 2. Secteurs et sous-secteurs supportés

**Secteurs principaux :**
- `hôtellerie` (sous-secteurs : hôtel_1_étoile à hôtel_5_étoiles, résidence_hôtelière)
- `restauration` (sous-secteurs : restaurant_traditionnel, gastronomique, brasserie, fast_food)
- `hôtellerie-restauration` (combinaison)
- `restauration_collective` (sous-secteurs : EHPAD, crèche, scolaire, entreprise, hôpital)

### 3. Déduplication intelligente

**Algorithme de fusion automatique :**

Quand un doublon est détecté (via `nom_canonique`, `ville`, ou `alias`), sans consigne explicite :

1. **Sélection du maître** :
   - Garder la fiche avec le plus de contacts ET d'actions
   - Si égalité : garder la plus récente (`updated_at`, puis `created_at`)

2. **Fusion** :
   - Re-router tous les contacts vers l'établissement maître
   - Re-router toutes les actions vers l'établissement maître
   - Fusionner les champs non vides (priorité au maître)
   - Marquer le doublon : `deleted_at = now()`

3. **Audit** :
   - Enregistrer dans `historique` : `action='merge_auto'`

**Cas particuliers :**
- Doublons parfaits (égalité totale) : l'agent propose 2 cartes synthèses et demande clarification UNE SEULE FOIS
- Commande explicite "fusionne X avec Y" : garde X comme maître

### 4. Gestion des alias

L'agent enregistre automatiquement les variantes de noms détectées :
- "Novotel" → "Novotel Lyon" → Crée un alias dans `etablissements_aliases`
- Améliore la détection de doublons pour les requêtes futures

### 5. Concurrence enrichie

**Création :**
"L'établissement X travaille avec Adecco sur la cuisine"
→ Crée une entrée `concurrence` avec :
- `concurrent_principal='Adecco'`
- `postes=['cuisine']`
- `secteur` et `sous_secteur` copiés de l'établissement
- `statut='actif'`

**Requêtes supportées :**
- "Quel concurrent est le plus présent en cuisine ?"
- "Quel est le coefficient moyen du concurrent Y ?"
- "Quels concurrents sont actifs dans la restauration collective ?"

**Statuts :**
- `actif` : Concurrent actuellement présent
- `historique` : Concurrent qui a travaillé par le passé
- `pressenti` : Concurrent potentiel identifié

### 6. Rappels et assignations

**Rappels automatiques :**
- Toute mention de date/heure → création automatique d'un `rappel_le`
- RDV : rappel par défaut 1h avant
- Tâche : rappel le jour J à 9h

**Assignations :**
- "Dis à Céline de rappeler M. X"
  → Recherche le `user_id` de Céline dans `utilisateurs_internes`
  → Assigne l'action avec `assigne_a = user_id_celine`

### 7. Transitions de statut

L'agent gère automatiquement les changements de statut :
- `prospect` → `client_actuel` : Dès signature de contrat
- `client_actuel` → `ancien_client` : Fin de collaboration

**Importante** : Tout l'historique d'actions et contacts est conservé.

### 8. Suppression sûre (soft delete)

**AUCUN hard delete dans le système :**
- Toute suppression marque `deleted_at = now()`
- Les enregistrements supprimés sont exclus des recherches normales
- Log dans `historique` avec `action='delete'`
- Possibilité de restauration future (via `deleted_at = NULL`)

## 📋 Commandes IA supportées

### Gestion des doublons
```
"Fusionne les doublons de Mercure Perrache"
→ Détecte et fusionne automatiquement

"Fusionne Novotel Lyon avec Novotel Bron"
→ Garde Novotel Lyon comme maître

"Liste les doublons détectés"
→ Recherche globale avec suggestions de fusion
```

### Gestion des établissements
```
"Crée client Novotel Bron à Bron, coef 2.048, groupe ACCOR"
→ Mapping automatique dans les champs dédiés

"Supprime le doublon Pullman Lyon"
→ Soft delete + log historique

"Change Hôtel Y en ancien client"
→ Mise à jour statut_commercial
```

### Gestion des contacts
```
"Déplace les contacts de B vers A"
→ Re-route tous les contacts

"RDV demain 15h avec M. Dupont au Novotel"
→ Crée action + rappel 1h avant + lie contact
```

### Gestion de la concurrence
```
"L'hôtel X travaille avec Adecco sur la cuisine"
→ Crée entrée concurrence

"Quel concurrent est le plus présent en service ?"
→ Requête analytique sur table concurrence
```

## 🧪 Tests recommandés

### Test 1 : Création avec mapping automatique
**Commande :** "Crée client Novotel Bron à Bron, coefficient 2.048, groupe ACCOR"

**Vérifications :**
- ✅ `type = client_actuel`
- ✅ `nom = Novotel Bron`
- ✅ `ville = Bron`
- ✅ `coefficient = 2.048`
- ✅ `groupe = ACCOR`
- ✅ `nom_canonique` généré automatiquement

### Test 2 : Fusion automatique
**Commande :** "Fusionne les doublons de Mercure Perrache"

**Vérifications :**
- ✅ Détection des doublons via `nom_canonique` et `ville`
- ✅ Fusion automatique (garde la fiche avec plus de données)
- ✅ Contacts et actions re-routés
- ✅ Doublon marqué `deleted_at`
- ✅ Log dans `historique` avec `action='merge_auto'`

### Test 3 : Rappel assigné
**Commande :** "Dis à Céline de rappeler M. Dupont demain 14h"

**Vérifications :**
- ✅ Action créée avec `type=rappel`
- ✅ `rappel_le` = demain 13h (1h avant)
- ✅ `assigne_a` = user_id de Céline
- ✅ Contact lié si M. Dupont existe

### Test 4 : Gestion de la concurrence
**Commande :** "L'Hôtel des Alpes travaille avec Adecco sur la cuisine"

**Vérifications :**
- ✅ Entrée créée dans `concurrence`
- ✅ `concurrent_principal = Adecco`
- ✅ `postes = ['cuisine']`
- ✅ `secteur` et `sous_secteur` copiés de l'établissement
- ✅ `statut = actif`

**Commande analytique :** "Quel concurrent est le plus présent en cuisine ?"

**Vérifications :**
- ✅ Requête correcte sur `concurrence` avec filtre `postes @> ARRAY['cuisine']`
- ✅ Agrégation et classement par nombre d'établissements

### Test 5 : Détection de doublon à la création
**Commande :** "Crée prospect Novotel Bron"

**Vérifications (si Novotel Bron existe déjà) :**
- ✅ Détection automatique du doublon
- ✅ Proposition de fusion avec fiche existante
- ✅ Pas de création de doublon

## 🔄 Rollback

Un fichier de rollback SQL est disponible : `supabase/migrations/rollback_hotelerie_restauration.sql`

Il permet de supprimer proprement toutes les modifications :
- Colonnes ajoutées
- Table `etablissements_aliases`
- Index créés
- Policies RLS

**Usage :**
```sql
-- Exécuter dans SQL Editor Supabase
\i supabase/migrations/rollback_hotelerie_restauration.sql
```

## 📊 Améliorations futures possibles

- Export Excel des doublons détectés
- Dashboard de visualisation de la concurrence
- Notifications automatiques pour les rappels
- Statistiques par concurrent et secteur
- Restauration UI pour les établissements soft-deleted

---

**Version :** 1.0  
**Date :** Janvier 2025  
**Auteur :** CRM ADAPTEL Lyon
