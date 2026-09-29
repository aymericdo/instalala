# Instalala

Script Node.js pour **@sophie.delauney69**, influenceuse parisienne lifestyle et mode : une photo verticale et une courte légende française chaque jour. Génération OpenAI, hébergement Cloudinary ou Nginx, publication avec la connexion directe Instagram.

Le prompt fourni est conservé intégralement dans `src/prompts/sophie.txt`. Des choix de tenue, lieu, coiffure, pose et orientation du visage sont ajoutés à chaque génération. L’historique évite de répéter les sept choix précédents (huit pour les lieux), y compris après redémarrage. Les images sont enregistrées en JPEG. Sans photo de référence, la ressemblance du visage entre les générations n’est pas garantie.

## Prérequis

- Node.js 20 ou supérieur ;
- un compte OpenAI API avec facturation active ;
- un compte Instagram **professionnel** (Business ou Creator) ;
- une application Meta avec l'autorisation de publier et un jeton d'accès longue durée ;
- une URL d'image publique fournie par Cloudinary ou Nginx, car Meta doit télécharger l'image avant de publier.

Un abonnement ChatGPT ne fournit pas automatiquement de crédits API OpenAI : la facturation API est séparée.

## Obtenir les identifiants

### OpenAI

1. Se connecter à [OpenAI Platform](https://platform.openai.com/).
2. Créer ou sélectionner un projet et activer la facturation API.
3. Ouvrir [API keys](https://platform.openai.com/api-keys), choisir **Create new secret key**, puis copier immédiatement la clé.
4. Placer cette valeur dans `OPENAI_API_KEY`. Ne jamais la committer dans Git ni l'intégrer à l'image Docker.

L'abonnement ChatGPT et la facturation de l'API sont distincts.

### Instagram avec Instagram Login

Avoir créé un compte sur business.facebook.com ne suffit pas : il faut ouvrir une **application développeur Meta** et autoriser le compte Instagram. Le repo utilise `graph.instagram.com`, avec **Instagram Login** ; une Page Facebook liée n’est pas nécessaire pour cette méthode.

1. Sur Instagram, passer **@sophie.delauney69** en compte professionnel **Créateur** ou **Business**.
2. Ouvrir [Meta for Developers → Mes applications](https://developers.facebook.com/apps/). Réutiliser l’application existante si elle propose Instagram Login, sinon créer une application proposant le cas d’utilisation de gestion des contenus Instagram.
3. Ouvrir **Instagram → API setup with Instagram login** (les intitulés peuvent varier selon le tableau de bord).
4. Dans **Generate access tokens**, choisir **Add account**, puis se connecter avec **@sophie.delauney69**. Si Meta demande un rôle de testeur, ajouter le compte dans les rôles de l’application et accepter l’invitation côté Instagram avant de recommencer.
5. Autoriser `instagram_business_basic` et `instagram_business_content_publish`, puis générer/copier le jeton Instagram. Un jeton de Page Facebook ou un jeton d’application ne convient pas à ce repo.
6. Dans le `.env` local, remplacer le jeton et **vider l’ancien identifiant** :

```env
INSTAGRAM_ACCESS_TOKEN=le_nouveau_jeton_instagram
INSTAGRAM_ACCOUNT_ID=
POST_SCHEDULE=daily
POST_INTERVAL_HOURS=24
```

7. Tester la connexion sans génération ni publication :

```bash
npm run check-account
```

Le résultat attendu est `Compte Instagram connecté : @sophie.delauney69`. Le script détecte l’identifiant automatiquement et refuse tout autre compte, même si `INSTAGRAM_ACCOUNT_ID` est renseigné. Ce contrôle ne garantit pas à lui seul que la permission de publication a été accordée.

Vérifier l’expiration du jeton dans Meta et le renouveler avant cette date ; le repo ne renouvelle pas automatiquement les jetons. Conserver les secrets dans `.env`, jamais dans Git ou dans une conversation.

Références : [collection officielle Instagram de Meta](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-23eacf45-3728-4e41-bcc7-6d164959327c), [configuration Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/).

## Installation locale

```bash
npm install
cp .env.example .env
```

Renseigner d'abord `OPENAI_API_KEY`, laisser `DRY_RUN=true`, puis tester :

```bash
npm run dry-run
```

L'image et la légende sont écrites dans `output/sophie.delauney69/`. Pour exécuter toute la chaîne — génération, hébergement temporaire et publication Instagram — utiliser :

```bash
npm start
```

`npm start` constitue une demande explicite de publication et ne dépend pas de `DRY_RUN`. Pour générer sans publier, utiliser exclusivement `npm run dry-run`.

La direction éditoriale est désormais le lifestyle parisien. `CONTENT_LANGUAGE`, `BRAND_VOICE` et `EXTRA_INSTRUCTIONS` ajustent la légende ; le prompt photo reste dans son fichier dédié. Les anciens fichiers Oresto restent à leur emplacement et ne sont pas utilisés par `publish-existing`.

La cadence par défaut est **un post par jour calendaire à Paris** (`POST_SCHEDULE=daily`). Si un post a déjà été enregistré aujourd’hui, le script s’arrête avant génération et publication. Les simulations restent possibles à tout moment. Pour revenir à un délai glissant, utiliser `POST_SCHEDULE=interval` et `POST_INTERVAL_HOURS` (24 par défaut).

Le cron interne (`src/scheduler.js`) déclenche la publication à **18 h, heure de Paris**. Les aperçus du même jour UTC sont remplacés par la dernière génération.

Conserver impérativement `output/` entre les exécutions : `output/sophie.delauney69/state.json` contient l’historique et la date du dernier succès. Un verrou empêche les exécutions concurrentes sur ce même dossier. Après un arrêt brutal, vérifier qu’aucun processus ne tourne avant de supprimer un éventuel `run.lock`. Si Meta a accepté un post mais que le processus s’est interrompu avant d’enregistrer son succès, vérifier le compte et corriger l’état avant de relancer pour éviter un doublon.

### Test complet local avec Cloudinary

Créer un compte sur [Cloudinary](https://cloudinary.com/users/register_free), puis copier dans le tableau de bord les valeurs **Cloud name**, **API Key** et **API Secret** :

```env
IMAGE_HOSTING=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
DRY_RUN=false
```

Pour publier l'image déjà générée aujourd'hui sans payer une nouvelle génération OpenAI :

```bash
npm run publish-existing
```

Après confirmation de la publication par Instagram, le script supprime automatiquement l'image temporaire de Cloudinary. En cas d'échec Instagram, elle est conservée pour faciliter le diagnostic. Ne jamais partager `CLOUDINARY_API_SECRET` ni le committer dans Git.

## Stories avec les posts

Par défaut, chaque publication envoie la photo avec sa légende dans le fil, puis la même image en story, sans nouvelle génération OpenAI. `npm run publish-existing` utilise également ce fonctionnement. Pour désactiver les stories, définir `PUBLISH_STORIES=false` dans `.env`.

La story utilise la photo verticale telle quelle : cette version n’ajoute pas de texte incrusté, de musique ni de stickers. La légende et les hashtags accompagnent le post du fil uniquement.

Le succès du post et celui de la story sont enregistrés séparément. Si le post réussit mais que la story échoue, la limite quotidienne reste appliquée au post. Après avoir vérifié sur Instagram que la story n’est pas déjà visible, relancer uniquement la story :

```bash
npm run publish-story-existing
```

Cette commande utilise la copie locale du dernier post (`last-post.jpg` et `last-post.txt`), même si un nouvel aperçu a été généré depuis. Elle ne génère pas d’image, ne republie pas le post et s’arrête si la story est déjà enregistrée comme publiée. L’image Cloudinary est conservée en cas d’échec ; une reprise peut laisser cet ancien fichier temporaire à nettoyer manuellement.

La publication du post et de la story a été testée avec succès sur @sophie.delauney69, compte `MEDIA_CREATOR`.

Référence : [publication Instagram, documentation Meta](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing).

## Déploiement Docker sur ton VPS

L’intégration utilise `/home/ubuntu/production/docker-compose.yml` et le dossier `/home/ubuntu/instalala`.
Le conteneur reste démarré et son cron interne publie chaque jour à **18 h (Europe/Paris)**. Le dossier `output/` est conservé sur l’hôte et Cloudinary héberge les images temporairement.

Suivre le [guide de déploiement](deploy/README.md) pour transférer le code, les secrets et l’historique, construire l’image, vérifier le compte puis démarrer le service.

## Limites importantes

- L'automatisation ne fonctionne pas avec un compte Instagram personnel classique.
- Le jeton Meta expire et doit être renouvelé selon sa configuration.
- Une exécution OpenAI génère des coûts API.
- Le mode simulation génère bien une image payante, mais ne l'expose pas via Nginx et ne l'envoie pas à Instagram.

## Vérification locale sans appel API

```bash
npm run check
npm test
```
