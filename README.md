# Lotery POS

Prototype responsive de point de vente pour tablette/téléphone Android. Interface disponible en français et en kreyòl ayisyen.

> **Démo uniquement.** Cette version ne traite pas de paris réels, ne vend pas de tickets de loterie et ne paie aucun gain. Ne l'utilisez pas en production sans validation juridique, autorisations et tests de sécurité.

## Démarrage local

Prérequis : Node.js 20.9+ et npm.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000.

Vérifier la compilation :

```bash
npm run build
```

## Fonctionnalités du prototype
- Interface responsive ordinateur/tablette/mobile.
- Sélecteur de langue : français / kreyòl ayisyen.
- Configuration de démonstration : New York, Floride, Géorgie.
- Création de reçus de test marqués « DEMO — SANS VALEUR ».
- Aperçu et impression navigateur à des fins de test uniquement.

Les reçus restent en mémoire de la page et ne sont pas enregistrés dans une base de données. Il n'y a pas encore d'authentification réelle, d'API, de synchronisation hors ligne ou d'intégration d'imprimante validée.

## Architecture et plan
Lire [docs/PLAN.md](docs/PLAN.md) avant d'ajouter un backend, une authentification ou une intégration matérielle.

## Prochaines étapes
1. Exécuter `npm install` et `npm run build`.
2. Confirmer le dépôt et le déploiement de cette branche.
3. Ajouter des tests et l'authentification/autorisation avant toute donnée réelle.
4. Choisir une imprimante seulement après avoir vérifié son SDK, sa connectivité et sa compatibilité Android.
5. Faire valider séparément les règles et autorisations de New York, de Floride et de Géorgie avant toute activité réelle.
