# Design system — UJADI ONGD / Easy‑O

Référence visuelle commune pour l’application « Accueil & communication interne ». La logique métier, les routes et les appels Supabase restent séparés du système visuel.

## Identité et typographie

- Marque affichée : **UJADI ONGD** — Union des Jeunes Actifs pour le Développement Intégral.
- Police : `Century Gothic`, puis `AppleGothic`, `URW Gothic`, `Arial`, sans-serif.
- Couleur d’accent : vert profond `#174A35`, avec vert sombre `#103927` et vert clair `#66A984`.
- Couleur de structure : bleu nuit `#0F172A`. Le bleu Easy-O d’origine est rethémé aux verts UJADI.
- Les badges de statut utilisent vert, orange et rouge ; ils ne deviennent pas des couleurs d’accent générales.

## Tokens CSS

Les tokens sont déclarés dans `css/style.css`. Modifie les valeurs ici, plutôt que de disperser les couleurs dans les composants.

| Usage | Token | Valeur |
|---|---|---|
| Fond principal | `--bg-page` | `#F0F4EF` |
| Cartes | `--bg-card` | `#FCFDF9` |
| Champs | `--bg-input` | `#EEF3EC` |
| Accent UJADI | `--primary` | `#174A35` |
| Accent sombre | `--primary-dark` | `#103927` |
| Titres | `--text-title` | `#0F172A` |
| Texte courant | `--text-body` | `#334155` |
| Texte secondaire | `--text-muted` | `#7C8799` |
| Bordures | `--border` | `#EDEFF3` |
| Rayon des cartes | `--radius-card` | `20px` |
| Rayon du cadre | `--radius-frame` | `28px` |
| Rayon des boutons | `--radius-btn` | `12px` |
| Espacement courant | `--gap` | `20px` |
| Padding des cartes | `--pad-card` | `24px` |

## Composants

- **Cadre** : largeur maximale de 1440 px ; fond très clair, cartes blanches, coins arrondis, ombres discrètes.
- **Hiérarchie** : titres foncés ; labels secondaires gris ; un seul bleu d’accent.
- **Bouton principal** : bleu d’accent et texte blanc. Les actions secondaires restent blanches et bordées.
- **Statuts** : vert pour autorisé/actif, orange pour en attente, rouge pour indisponible/annulé.
- **Formulaires** : champs de 44 px de hauteur, focus visible, libellés explicites.
- **Fenêtres modales** : fond assombri, panneau blanc, utilisables au clavier et adaptées au téléphone.
- **Navigation mobile** : raccourcis bas d’écran et prise en compte de la zone de sécurité iOS.
- **Interactions** : transitions légères ; désactiver les animations importantes quand `prefers-reduced-motion` est actif.

## Responsive

- **1200 px et plus** : contenu spacieux dans le cadre principal.
- **801–1199 px** : cartes et statistiques en grilles réduites ; marges diminuées.
- **800 px et moins** : navigation de bureau masquée au profit des raccourcis fixes du bas ; modales en panneau bas ; boutons tactiles larges.
- **390 px et moins** : réduire les marges, sans réduire la lisibilité ni le contraste.

## Principes d’implémentation

1. Tous les écrans métier partagent les mêmes variables, badges, boutons, champs, cartes et modales.
2. Les noms de fichiers HTML restent à la racine pour la navigation dans MIT App Inventor WebViewer.
3. Supabase Auth conserve sa session sur l’appareil via `persistSession`, `autoRefreshToken` et `localStorage`. Une déconnexion explicite ou l’effacement des données du navigateur supprime cette persistance.
4. Les messages de conversation sont rattachés à une demande de visite et protégés par RLS. Seuls la réception, le secrétariat, l’administration et les collaborateurs autorisés sur cette visite peuvent les consulter.
5. Le fichier `assets/logo-ujadi.png` reprend le logo UJADI visible dans la maquette institutionnelle enregistrée dans la bibliothèque du projet. Pour une netteté optimale sur les écrans haute densité, remplacer ultérieurement ce recadrage par le fichier source officiel PNG/SVG, sans changer les tokens.


## Surfaces réchauffées et fonctions d’interface

- Le fond général utilise un vert-gris très pâle (`--bg-app: #E8EFE8`) ; la zone de travail utilise `--bg-page: #F0F4EF`.
- Les cartes sont légèrement cassées (`--bg-card: #FCFDF9`) et les panneaux de contenu utilisent `--surface-soft: #F7FAF5` ; l’écran n’est donc plus une succession de surfaces blanc pur.
- Le panneau d’accueil de la réception utilise `--surface-tint: #E5EFE5`.
- Le point rouge des conversations non lues est piloté par `--chat-red` et `--chat-red-halo`.
- La pagination commune affiche cinq visites par page. L’espace personnel filtre les demandes par journée locale et repart sur la journée courante.
- Les photos de visiteurs sont capturées depuis l’appareil photo, compressées en JPEG et envoyées vers le bucket privé `visitor-photos`. Les images sont consultées avec des URL signées selon les règles d’accès à la visite.
- Dans l’administration, seuls les administrateurs affectent les collaborateurs aux étages ; l’activation, la désactivation et le renommage des étages restent dans la gestion des étages.
