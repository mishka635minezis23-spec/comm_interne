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

L’application pointe vers le projet `ujadi_service_comm` configuré dans `config.js`. La clé publishable est une clé client publique ; ne jamais exposer une clé `service_role` ou une clé secrète.

### Comptes initiaux

Crée les comptes en envoyant des invitations par e-mail depuis le Dashboard Supabase : [Auth → Users](https://supabase.com/dashboard/project/vdbastunbdqkpuzcftpz/auth/users).

- `reception@ujadiongd.org` — le déclencheur de base crée automatiquement le profil avec le rôle `reception`.
- `sec@ujadiongd.org` — le déclencheur crée automatiquement le profil `Secrétariat` avec le rôle `secretary`.

Les deux adresses ont été vérifiées dans Auth et ne correspondent actuellement à aucun compte. Une fois les invitations créées dans Supabase Auth, les profils et rôles seront créés automatiquement. Les destinataires définiront eux-mêmes leur mot de passe via le flux d’invitation. Le connecteur utilisé pour cette session ne fournit pas d’opération d’invitation Auth, donc ces deux invitations doivent être envoyées depuis le Dashboard.

Le rôle `secretary` permet de gérer les visites, l’historique, les étages et les motifs. Seul le rôle `admin` peut modifier les rôles et désactiver des comptes.

Pour initialiser un administrateur, crée d’abord son compte dans Supabase Auth puis exécute dans le SQL Editor en remplaçant l’UUID :

```sql
update public.staff_members
set role = 'admin'
where id = 'UUID_DU_COMPTE';
```

## MIT App Inventor WebViewer

Configurer `WebViewer1.HomeUrl` vers l’URL HTTPS de `index.html`, `FollowLinks=true`, `UseExternalBrowser=false` et `IgnoreSslErrors=false`. Voir `MIT_APP_INVENTOR_SETUP.md` pour le pont JavaScript ↔ blocs.

## État

Socle actuel : connexion, création et suivi des visites, réponses, disponibilité, historique, administration des étages, conversations internes avec état de lecture, capture photo des visiteurs dans un bucket privé et visionneuse photo plein écran. L’intégration Capacitor/FCM, la génération APK/AAB par GitHub Actions, l’automatisation des notifications en arrière-plan et les tests complets sur appareils restent les prochaines étapes.
