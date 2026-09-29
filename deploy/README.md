# Déployer sur le VPS existant

Objectif : un post avec sa légende et sa story chaque jour à **18 h, Europe/Paris**.
Les fichiers du dépôt `production` ont été adaptés localement. Aucun déploiement distant n’a été activé par cette modification.

## 1. Transférer les deux dépôts

Mettre à jour `production` sur le VPS via votre workflow Git habituel. Le repo Instalala local n’a actuellement pas de remote Git configuré : le publier dans un dépôt privé puis le cloner dans `/home/ubuntu/instalala` pour bénéficier de `deployer.sh`, ou effectuer un premier transfert avec `rsync`.

Exemple depuis le Mac (remplacer `VPS_HOST` par votre adresse/alias SSH) :

```bash
rsync -av --exclude='.git' --exclude='.env' --exclude='node_modules' --exclude='output' --exclude='.DS_Store' /Users/aymeric/Perso/instalala/ ubuntu@VPS_HOST:/home/ubuntu/instalala/
```

Si Instalala est transféré sans Git, ne pas exécuter le déployeur global pour le mettre à jour : reconstruire uniquement son service avec la commande de l’étape 3. Pour les mises à jour automatiques, le dépôt doit avoir une branche `main` avec un upstream configuré.

## 2. Transférer les secrets et l’historique

Pour une première installation, copier le `.env` actuel (OpenAI, Instagram et Cloudinary) et le dossier `output/`. Ce dernier conserve la date du post déjà publié, évite de republier le même jour et contient les fichiers nécessaires à une reprise de story.

Depuis le Mac, avant de démarrer le service :

```bash
scp /Users/aymeric/Perso/instalala/.env ubuntu@VPS_HOST:/home/ubuntu/instalala/.env
rsync -av --exclude='run.lock' --exclude='*.tmp' /Users/aymeric/Perso/instalala/output/ ubuntu@VPS_HOST:/home/ubuntu/instalala/output/
```

Ne pas écraser l’historique du VPS avec une ancienne copie locale lors des mises à jour suivantes. Après la migration, utiliser le VPS comme unique point de publication : deux dossiers `output/` distincts ne partagent pas le verrou ni la limite quotidienne.

Sur le VPS :

```bash
chmod 600 /home/ubuntu/instalala/.env
sudo install -d -o 1000 -g 1000 /home/ubuntu/instalala/output
sudo chown -R 1000:1000 /home/ubuntu/instalala/output
```

Le conteneur utilise l’utilisateur `node` (UID 1000). Le `.env` est lu par Docker sur l’hôte, jamais copié dans l’image. Compose fixe `POST_SCHEDULE=daily`, `PUBLISH_STORIES=true` et `IMAGE_HOSTING=cloudinary`.

## 3. Construire et vérifier sans publier

```bash
cd /home/ubuntu/production
sudo docker compose config --quiet
sudo docker compose build instalala
sudo docker compose run --rm --no-deps -T instalala node src/index.js --check-account
```

Résultat attendu : `Compte Instagram connecté : @sophie.delauney69`.
Le service n’expose aucun port et n’a pas besoin de modification Nginx. Son démarrage lance le cron interne et attend le prochain créneau.

## 4. Activer la publication quotidienne

```bash
cd /home/ubuntu/production
sudo docker compose up -d instalala
sudo docker compose logs --tail=100 instalala
```

Le cron est défini **dans Instalala**, dans `src/scheduler.js` : `0 18 * * *`, fuseau `Europe/Paris`. Le Dockerfile lance cet ordonnanceur ; aucune crontab ou unité systemd n’est à installer sur le VPS. Pour le lancer hors Docker : `npm run schedule`.

Le démarrage du service active les publications futures et les frais API de génération. Le conteneur attend le prochain créneau à 18 h ; il ne publie pas au démarrage. Si le VPS est arrêté à 18 h, le créneau est manqué : pas de rattrapage immédiat au redémarrage. Une erreur de publication est journalisée, sans nouvelle tentative automatique le même jour.

Si l’ancien timer proposé a déjà été installé, le désactiver avant de démarrer ce service : `sudo systemctl disable --now instalala.timer`. Vérifier aussi qu’aucun ancien cron ne lance Instalala. Aucune de ces anciennes tâches n’a été activée par les modifications locales.

## Exploitation

```bash
cd /home/ubuntu/production

# Logs et prochain lancement annoncé au démarrage
sudo docker compose logs --tail=100 -f instalala

# Déclenchement manuel : publie réellement si aucun post n’a été enregistré aujourd’hui
sudo docker compose exec instalala node src/index.js --publish

# Reprendre uniquement la story après avoir vérifié qu’elle n’est pas déjà visible
sudo docker compose exec instalala node src/index.js --publish-story-existing

# Suspendre les futurs lancements
sudo docker compose stop instalala
```

Les jetons Instagram doivent toujours être renouvelés avant expiration. Les échecs sont visibles dans les logs Docker. L’arrêt du conteneur laisse jusqu’à 30 minutes à une publication en cours pour terminer et enregistrer son état. Après un arrêt brutal, vérifier l’état du post sur Instagram et qu’aucun conteneur Instalala ne tourne avant de supprimer un éventuel `output/sophie.delauney69/run.lock`.

`deployer.sh` reconstruit puis redémarre Instalala comme tous les autres services. Le cron est chargé depuis la nouvelle image à chaque redémarrage. Pour modifier l’heure, modifier `src/scheduler.js` puis reconstruire/redéployer.
