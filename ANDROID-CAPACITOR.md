# Application Android UJADI avec Capacitor

Identifiant Android permanent : `org.ujadiongd.accueil`.

L'application web multipage reste à la racine du dépôt. Capacitor l'embarque depuis `dist/`. La PWA iPhone et les pages web existantes conservent leur fonctionnement.

## Préparer Android en local

Prérequis : Node.js 22 ou plus récent, Android Studio 2025.2.1 minimum et Android SDK installé.

```bash
npm install
npm run android:prepare
```

La commande génère le projet Android Capacitor (dans `android/`, ignoré par Git), copie les classes natives UJADI, remplace le service FCM du plugin par le service UJADI puis synchronise les plugins. Ouvre ensuite `android/` dans Android Studio.

Pour régénérer les ressources web après une modification :

```bash
npm run build
npx cap sync android
```

## Configurer Firebase Cloud Messaging

1. Crée un projet dans Firebase Console.
2. Ajoute une application Android avec le package exact `org.ujadiongd.accueil`.
3. Télécharge `google-services.json` et place-le dans `android/app/google-services.json` pour les builds locaux.
4. Active l'API Firebase Cloud Messaging dans le projet Google Cloud.
5. Crée un compte de service autorisé à envoyer des messages FCM et télécharge son JSON privé.

Ne commite jamais `google-services.json` ni le JSON du compte de service dans le dépôt.

### GitHub Actions

Dans les secrets du dépôt GitHub, ajoute :

- `GOOGLE_SERVICES_JSON_BASE64` : contenu base64 du fichier `google-services.json`.

Sous PowerShell :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
```

Sous Linux/macOS :

```bash
base64 -w 0 google-services.json
```

Le workflow `.github/workflows/android-apk.yml` compile un APK debug à chaque push sur `main`, lors d'une Pull Request vers `main`, ou manuellement. L'APK est publié comme artefact GitHub Actions.

## Configurer l'envoi FCM côté Supabase

La fonction `send-visit-alert` est déployée séparément et utilise le secret serveur `FCM_SERVICE_ACCOUNT_JSON`.

Dans Supabase Dashboard, ouvre **Project Settings → Edge Functions → Secrets** et ajoute :

- Nom : `FCM_SERVICE_ACCOUNT_JSON`
- Valeur : le contenu JSON complet du compte de service Firebase (incluant `project_id`, `client_email` et `private_key`).

La fonction utilise aussi les variables serveur Supabase prédéfinies `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé de service n'est jamais placée dans l'application mobile.

Les appels sont déclenchés par l'application de réception lors de la création d'une visite, puis par le collaborateur ou la réception lors de la résolution. Aucun jeton FCM ou secret Firebase n'est exposé dans le navigateur.

## Fonctionnement de la sonnerie persistante

- Une demande nouvelle envoie un message FCM Android de haute priorité aux appareils Android des destinataires.
- Le service natif UJADI lance une notification persistante et répète la sonnerie d'alarme configurée sur le téléphone.
- Le bouton **Ouvrir** ou **J'ai vu** arrête localement l'alerte et ouvre la demande.
- Lorsqu'un collaborateur répond, le serveur envoie l'ordre d'arrêt aux appareils Android associés à tous les destinataires.
- Lorsqu'un collaborateur acquitte l'alerte depuis un appareil, l'ordre d'arrêt ne cible que ses propres appareils.

Cette alerte est un service Android de lecture audio au premier plan (`mediaPlayback`). Android reste maître des permissions, du volume, du mode Ne pas déranger et des restrictions d'exécution. Une alerte ne peut pas être garantie si l'utilisateur force l'arrêt de l'application, coupe le son, désactive les notifications, perd le réseau ou si le fabricant bloque l'activité en arrière-plan. Les messages d'alerte utilisent une priorité élevée uniquement pour la demande d'audience, pas pour les échanges de chat.

## Production

Le workflow produit un APK debug non signé pour les tests internes. Avant distribution générale, il faudra créer une clé de signature release et ajouter un workflow de signature avec des secrets GitHub dédiés. Ne pas réutiliser la clé debug pour une diffusion durable.
