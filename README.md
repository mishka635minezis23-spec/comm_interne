# Communication interne — gestion des visiteurs

Application de gestion des visiteurs pour un bureau, pensée pour MIT App Inventor WebViewer côté Android et PWA côté réception iPhone.

## Lancer en local avec Vite

Prérequis : Node.js **22.12 ou plus récent** et npm.

```bash
git clone https://github.com/mishka635minezis23-spec/comm_interne.git
cd comm_interne
npm install
npm run dev
```

Ouvre ensuite l’interface d’administration directement à :

`http://localhost:5173/admin.html`

Les autres pages sont accessibles sans sous-dossier :

- `http://localhost:5173/index.html`
- `http://localhost:5173/reception.html`
- `http://localhost:5173/personnel.html`
- `http://localhost:5173/disponibilite.html`
- `http://localhost:5173/historique.html`

Pour vérifier la compilation de toutes les pages :

```bash
npm run build
npm run preview
```

## Pages à la racine

- `index.html` — connexion
- `reception.html` — accueil et suivi des visiteurs
- `personnel.html` — demandes et réponses des collaborateurs
- `disponibilite.html` — disponibilité personnelle
- `historique.html` — registre des visites
- `admin.html` — gestion des profils, étages et motifs

Toutes les pages sont directement à la racine du dépôt pour assurer une navigation simple dans MIT App Inventor WebViewer.

## Stack

- HTML, CSS, JavaScript
- Vite pour le serveur de développement et la compilation multipage
- Supabase Auth, PostgreSQL et Realtime
- MIT App Inventor WebViewer pour l’APK Android
- PWA pour la réception sur iPhone
- FCM/Web Push pour les notifications système (intégration restante)

## Supabase

L’application pointe vers le projet Supabase configuré dans `config.js`. La clé publishable est une clé client publique ; ne jamais exposer une clé `service_role` ou une clé secrète.

Les comptes doivent exister dans Supabase Auth. Le déclencheur crée automatiquement leur profil avec le rôle `member`. Pour initialiser le premier administrateur, exécute dans le SQL Editor en remplaçant l’UUID :

```sql
update public.staff_members
set role = 'admin'
where id = 'UUID_DU_COMPTE';
```

Le profil administrateur doit être créé par l’authentification avant l’attribution du rôle. Pour des tests, utilise des comptes séparés pour l’administration, la réception et le personnel.

## MIT App Inventor WebViewer

Configurer `WebViewer1.HomeUrl` vers l’URL HTTPS de `index.html`, `FollowLinks=true`, `UseExternalBrowser=false` et `IgnoreSslErrors=false`. Voir `MIT_APP_INVENTOR_SETUP.md` pour le pont JavaScript ↔ blocs.

## État

Socle initial : connexion, création et suivi des visites, réponses, disponibilité, historique et administration simple. Les notifications push, le téléversement de photos vers un bucket privé, l’automatisation des relances et les tests de bout en bout restent à terminer avant usage en production.
