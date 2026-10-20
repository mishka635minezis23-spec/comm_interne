# MIT App Inventor WebViewer — configuration

Cette version utilise MIT App Inventor comme conteneur APK. L’interface HTML/CSS/JavaScript est hébergée sur une URL HTTPS et affichée dans WebViewer. Toutes les pages HTML se trouvent à la racine du site pour permettre une navigation par liens relatifs.

## 1. Héberger l’application

Publier le contenu du dépôt sur un hébergement HTTPS (par exemple GitHub Pages ou Cloudflare Pages). La page d’accueil doit être accessible par une URL comme :

`https://VOTRE-DOMAINE/index.html`

Le fichier `config.js` configure le client Supabase. La clé publishable est destinée à être incluse dans le frontend ; ne jamais y placer de clé `service_role`.

## 2. Propriétés de WebViewer1

- `HomeUrl` : `https://VOTRE-DOMAINE/index.html`
- `FollowLinks` : `true`
- `UseExternalBrowser` : `false`
- `IgnoreSslErrors` : `false`
- `Width` et `Height` : `Fill parent`

Le site doit disposer d’un certificat HTTPS valide. Ne désactive pas la validation SSL.

## 3. Bouton Retour Android

Dans `Screen1.BackPressed`, appelle `WebViewer1.GoBack` si l’historique de navigation permet un retour. Si l’application n’a plus d’historique, affiche une confirmation ou revient à `index.html`.

## 4. Pont JavaScript ↔ MIT App Inventor

Le fichier `js/mitappinventor-bridge.js` est inclus dans chaque page. Dans un navigateur ordinaire, il reste inactif. Dans WebViewer, il transmet un message JSON via `window.AppInventor.setWebViewString(...)`. Le bloc `WebViewer1.WebViewStringChange(value)` peut décoder ce message avec `Web.JsonTextDecodeWithDictionaries`.

Exemple de message reçu dans App Inventor :

```json
{
  "channel": "comm-interne",
  "direction": "to-native",
  "id": "identifiant-unique",
  "action": "page.ready",
  "payload": { "page": "personnel.html" }
}
```

Pour répondre à la page, définir `WebViewer1.WebViewString` avec un JSON portant `channel: "comm-interne"`, `direction: "to-web"`, un `id` unique, une `action` et un objet `payload`.

Actions prévues :
- `page.ready` — page chargée ;
- `camera.request` — demande de capture photo native ;
- `notifications.permission.request` — demande d’autorisation de notification ;
- `notifications.token` — transmission du jeton FCM obtenu par un composant/une extension ;
- `navigate` — navigation vers une page HTML à la racine ;
- `refresh` — rechargement de la page ;
- `toast` — message temporaire.

Ce pont transmet des messages ; il n’implémente pas la caméra native, FCM ni l’exécution lorsque l’APK est fermée. Ces fonctions nécessitent des blocs, un composant ou une extension App Inventor et une fonction serveur sécurisée pour envoyer les alertes.

## 5. Notifications en arrière-plan

Un WebViewer seul ne garantit pas qu’une notification sonore soit délivrée lorsque l’APK est fermée. Pour les alertes Android, intégrer un composant/une extension FCM adaptée à MIT App Inventor, enregistrer les jetons d’appareils dans la table `devices`, et déclencher l’envoi depuis une Supabase Edge Function sécurisée. Ne jamais placer une clé serveur FCM ou `service_role` dans le frontend ou dans l’APK.

## 6. Tests de validation

1. Ouvrir `index.html` via HTTPS.
2. Vérifier que les liens vers les six pages restent dans le WebViewer.
3. Créer des comptes de test avec les rôles admin, réception et membre.
4. Tester la création d’une visite et les trois réponses.
5. Vérifier la mise à jour en temps réel et l’accès interdit aux mauvais rôles.
6. Tester le bouton Retour Android.
7. Tester FCM séparément après l’intégration native.

## Limites actuelles

La base et les interfaces initiales sont installées, mais l’intégration des notifications système, le téléversement des photographies dans un bucket privé, les rappels automatiques et les tests de bout en bout restent à réaliser.
