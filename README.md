# DMC Carrière Sable — Système de Traçabilité (PWA)

Application PWA Offline-First de gestion d'exploitation, traçabilité des chargements, carburant, dépenses et clôture journalière pour la carrière **Dynasty Mining Company (DMC)** à Boussoura (Kindia, Guinée).

## 🚀 Fonctionnalités Clés
- **PWA Offline-First** : Fonctionne sans connexion internet sur le chantier (IndexedDB avec Dexie.js).
- **Synchronisation Cloud Temps Réel** : Synchronisation bidirectionnelle avec Supabase PostgreSQL dès que le réseau est disponible.
- **Profils & Sécurité** : Espaces dédiés Agent de Terrain (Pointeur), Propriétaire (Direction) et Administrateur avec code PIN d'approbation.
- **Export & Rapports** : Génération instantanée de bordereaux PDF et exports Excel conformes au cahier des charges DMC.

## 🛠️ Stack Technique
- **Frontend** : React 19, TypeScript, Vite, CSS Vanilla Premium
- **PWA** : Service Worker Workbox, Web App Manifest
- **Base de données** : Supabase (PostgreSQL) + Dexie.js (IndexedDB local)
- **Déploiement** : Vercel
- **Revue de code** : CodeRabbit AI
