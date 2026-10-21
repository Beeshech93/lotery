# Lotery — Plan de fondation

## Objectif
Construire une interface POS utilisable sur téléphone/tablette Android, en français et en kreyòl ayisyen, avec administration, rôles et impression thermique. Cette première phase est une démonstration technique : aucune prise de pari réelle, vente de tickets de loterie ni paiement de gains ne doit être activé avant validation juridique et autorisations applicables.

## État initial
- Dépôt existant : README minimal, sans instructions d'installation.
- Appareil : téléphone/tablette Android.
- Imprimante : pas encore achetée.
- Priorité : définir un socle testable avant de choisir le matériel.

## Architecture proposée
- Frontend : Next.js + TypeScript, interface responsive/PWA.
- Backend et données : Supabase (PostgreSQL, Auth, Row Level Security), sous réserve de confirmer le compte et le projet existants.
- Impression : abstraction PrinterAdapter; commencer par un aperçu et des reçus de test, puis tester Bluetooth/USB/Wi-Fi avec un modèle réel.
- Langues : français (fr) et kreyòl ayisyen (ht), avec dictionnaires séparés.
- États : configuration indépendante par juridiction; ne pas supposer que les règles sont identiques entre New York, Florida et Georgia.

## Modules du MVP
1. Connexion et rôles (admin, caissier).
2. Tableau de bord de démonstration.
3. Configuration de la juridiction et de la langue.
4. Historique de reçus de test, clairement marqués « DEMO — SANS VALEUR ».
5. Prévisualisation et impression de reçus de test.
6. Journal d'audit des actions administratives.
7. Gestion des terminaux et paramètres d'imprimante.

## Modèle de données initial (à valider avant migration)
- profiles: id, display_name, role, active, created_at
- terminals: id, label, jurisdiction, active, created_at
- demo_receipts: id, terminal_id, created_by, demo_reference, payload, created_at
- audit_events: id, actor_id, action, entity_type, entity_id, metadata, created_at

Ne jamais stocker de secrets côté navigateur. Activer les politiques RLS pour toutes les tables exposées et valider les autorisations côté serveur.

## Ordre de réalisation
1. Inspecter le dépôt, ses paramètres et les éventuels secrets accidentellement suivis.
2. Créer l'application responsive et la navigation.
3. Ajouter les langues FR/HT et les rôles.
4. Ajouter les reçus de démonstration et leur aperçu.
5. Ajouter l'adaptateur d'impression et tester sur le matériel choisi.
6. Ajouter tests, journalisation et documentation de déploiement.
7. Vérifier séparément les obligations légales, contrats et autorisations dans chaque État avant toute utilisation réelle.

## Critères d'acceptation
- L'application démarre avec des instructions reproductibles.
- L'interface est utilisable sur écran mobile et tablette.
- Les textes principaux sont disponibles en français et kreyòl.
- Un utilisateur sans rôle autorisé ne peut pas ouvrir l'administration.
- Chaque reçu de démonstration est marqué comme sans valeur et peut être prévisualisé.
- L'impression n'est déclarée compatible qu'après un test sur le modèle exact d'imprimante.
- Aucun flux de pari réel ou paiement de gain n'est activé dans le MVP.

## Choix matériel — liste de vérification
Avant l'achat, demander au vendeur :
- Android version and security update policy;
- Bluetooth Classic, BLE, USB OTG ou Wi-Fi pris en charge;
- ESC/POS et/ou SDK officiel documenté;
- largeur papier (58 mm ou 80 mm), coupe-papier et disponibilité du papier;
- politique de retour et possibilité de tester un exemplaire;
- certification et conformité applicables au marché de vente.

Acheter un seul exemplaire pour test avant d'en commander plusieurs.