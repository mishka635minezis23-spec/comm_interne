# Communication interne — gestion des visiteurs

Application web de gestion des visiteurs pour un bureau.

## Interfaces

Toutes les pages HTML sont directement à la racine du dépôt, au même niveau que `index.html`, afin que MIT App Inventor WebViewer puisse naviguer par des liens relatifs simples.

- `index.html` — connexion
- `reception.html` — accueil et suivi des visiteurs
- `personnel.html` — alertes visibles et réponses des collaborateurs
- `disponibilite.html` — disponibilité personnelle
- `historique.html` — registre des visites
- `admin.html` — administration des profils, étages et motifs

## Technologies

- HTML, CSS et JavaScript
- Supabase Auth, PostgreSQL et Realtime
- Supabase Storage (photos privées : configuration restante)
- MIT App Inventor WebViewer pour l’application Android
- PWA pour la réception sur iPhone
- FCM/Web Push : intégration des notifications système restant à faire

## Configuration

1. Publier les fichiers sur un hébergement HTTPS.
2. Vérifier l’URL et la clé publique dans `config.js`.
3. Exécuter le schéma SQL du projet Supabase (voir `database.sql` quand présent ou le dossier des migrations).
4. Créer les comptes utilisateurs dans Supabase Auth. Un profil est automatiquement créé avec le rôle `member`.
5. Pour initialiser l’administrateur, récupérer l’UUID du compte dans Supabase Auth puis mettre à jour le rôle dans SQL Editor :
   ```sql
   update public.staff_members
   set role = 'admin'
   where id = 'UUID_DU_COMPTE';
   ```
6. Créer les comptes de réception dans Supabase Auth puis leur affecter le rôle `reception` depuis la page d’administration ou SQL Editor.

## MIT App Inventor WebViewer

Configurer `WebViewer1.HomeUrl` vers l’URL HTTPS de `index.html`, `FollowLinks=true`, `UseExternalBrowser=false` et `IgnoreSslErrors=false`. La touche Retour Android doit gérer l’historique WebViewer dans les blocs App Inventor.

Le fichier `js/mitappinventor-bridge.js` prévoit un pont JSON avec `WebViewerString` pour commander la caméra ou transmettre des événements aux blocs. Il ne fournit pas, à lui seul, les fonctions natives.

## Sécurité

- La clé `sb_publishable_...` est une clé publique de client, pas une clé secrète.
- Ne jamais embarquer une clé `service_role`, une clé secrète Firebase ou un jeton administrateur dans les pages ou dans l’APK.
- Les permissions RLS doivent rester actives.
- Les notifications push et le stockage privé des photos ne sont pas encore terminés.
- Le MVP doit être testé avec des comptes distincts admin, réception et personnel avant toute utilisation réelle.

## État

Socle fonctionnel initial : authentification, création/suivi des visites, réponses, disponibilité, historique et administration simple. Les notifications hors application, l’envoi de photos vers un bucket privé, le traitement automatique des délais et les tests fonctionnels de bout en bout sont les prochaines étapes.
