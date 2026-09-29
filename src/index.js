import "dotenv/config";
import { mkdir, readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chooseVariation, publicationDue, dailyPublicationDue } from "./planning.js";
import { publishBundle } from "./publication.js";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";

const checkAccount = process.argv.includes("--check-account");
const outputDirectory = path.resolve("output", "sophie.delauney69");
const statePath = path.join(outputDirectory, "state.json");

const cliDryRun = process.argv.includes("--dry-run");
const storyOnly = process.argv.includes("--publish-story-existing");
const publishExisting = process.argv.includes("--publish-existing");
const cliPublish = process.argv.includes("--publish") || publishExisting || storyOnly;
if (cliDryRun && cliPublish) {
  throw new Error("Les options --dry-run et --publish sont incompatibles.");
}
const dryRun = cliDryRun || (!cliPublish && process.env.DRY_RUN !== "false");

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(", ")}`);
  }
}

function getConfig() {
  if (!checkAccount && !publishExisting && !storyOnly) requireEnv(["OPENAI_API_KEY"]);
  if (checkAccount) requireEnv(["INSTAGRAM_ACCESS_TOKEN"]);

  if (!dryRun && !checkAccount) {
    requireEnv(["INSTAGRAM_ACCESS_TOKEN"]);
    const hosting = process.env.IMAGE_HOSTING || "cloudinary";
    if (hosting === "cloudinary") {
      requireEnv(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]);
    } else if (hosting === "nginx") {
      requireEnv(["PUBLIC_IMAGE_DIR", "PUBLIC_IMAGE_BASE_URL"]);
    } else {
      throw new Error("IMAGE_HOSTING doit valoir cloudinary ou nginx.");
    }
  }

  const schedule = process.env.POST_SCHEDULE || "daily";
  if (!["daily", "interval"].includes(schedule)) throw new Error("POST_SCHEDULE doit valoir daily ou interval.");
  return {
    schedule,
    publishStories: process.env.PUBLISH_STORIES !== "false",
    language: process.env.CONTENT_LANGUAGE || "français",
    voice: process.env.BRAND_VOICE || "naturel, parisien, chaleureux et spontané",
    extraInstructions: process.env.EXTRA_INSTRUCTIONS || "",
    intervalHours: Number(process.env.POST_INTERVAL_HOURS || 24),
    expectedUsername: "sophie.delauney69",
    textModel: process.env.OPENAI_TEXT_MODEL || "gpt-5.6-luna",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    imageQuality: process.env.IMAGE_QUALITY || "medium",
    graphVersion: process.env.META_GRAPH_VERSION || "v24.0",
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID,
    imageHosting: process.env.IMAGE_HOSTING || "cloudinary",
  };
}

async function createEditorialContent(openai, config, state) {
  const basePrompt = await readFile(new URL("./prompts/sophie.txt", import.meta.url), "utf8");
  const variation = chooseVariation(state.history);
  const imagePrompt = `${basePrompt}\n\nSpecific choices for this generation:\n${JSON.stringify(variation, null, 2)}`;
  const response = await openai.responses.create({
    model: config.textModel,
    input: `Écris une légende Instagram prête à publier pour @sophie.delauney69, personnage d'influenceuse parisienne lifestyle et mode.
Langue : ${config.language}. Ton : ${config.voice}.
Scène : ${JSON.stringify(variation)}.
Écris à la première personne, comme un petit mot spontané à sa communauté, pas comme une description technique de la photo.
Commence par une accroche courte, puis évoque une humeur, un détail de la tenue ou le plaisir d'une balade parisienne en 2 à 4 phrases (40 à 80 mots maximum hors hashtags).
Ne récite pas la tenue, la coiffure, la pose et l'orientation du visage. Évite les clichés comme « l'esprit bien parisien », les slogans et le ton publicitaire.
Tu peux terminer par une question simple liée à la scène si elle vient naturellement, sans appel artificiel aux likes ou aux abonnements.
Utilise 0 à 2 emojis et des paragraphes courts séparés par une ligne vide.
Termine sur une ligne séparée avec 3 à 5 hashtags ciblés sur Paris, le style ou l'ambiance de la scène. Aucun hashtag générique de type #viral ou #followme.
N'invente pas de marque, partenariat, nom de commerce, adresse précise, événement personnel ou météo non fournis. Aucun discours commercial.
Retourne uniquement la légende complète, sans guillemets, titre, explication ni liste de variantes.
Contraintes supplémentaires : ${config.extraInstructions}`,
  });
  const caption = response.output_text?.trim();
  if (!caption) throw new Error("OpenAI n'a renvoyé aucune légende.");
  return { imagePrompt, caption, variation };
}

async function generateImage(openai, config, prompt) {
  const response = await openai.images.generate({
    model: config.imageModel,
    prompt,
    size: "1024x1536",
    quality: config.imageQuality,
    output_format: "jpeg",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI n'a renvoyé aucune image.");
  return Buffer.from(base64, "base64");
}

async function savePreview(image, content) {
  await mkdir(outputDirectory, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const imagePath = path.join(outputDirectory, `${stamp}.jpg`);
  const captionPath = path.join(outputDirectory, `${stamp}.txt`);
  await Promise.all([
    writeFile(imagePath, image),
    writeFile(captionPath, `${content.caption}\n\nPrompt :\n${content.imagePrompt}\n`),
  ]);
  return { imagePath, captionPath, stamp };
}

async function exposeImageThroughNginx(image) {
  const publicDirectory = path.resolve(process.env.PUBLIC_IMAGE_DIR);
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const filename = `instagram-${timestamp}.jpg`;
  await mkdir(publicDirectory, { recursive: true });
  await writeFile(path.join(publicDirectory, filename), image);

  const baseUrl = `${process.env.PUBLIC_IMAGE_BASE_URL.replace(/\/+$/, "")}/`;
  const imageUrl = new URL(filename, baseUrl);
  if (imageUrl.protocol !== "https:") {
    throw new Error("PUBLIC_IMAGE_BASE_URL doit être une URL publique en HTTPS.");
  }
  return imageUrl.toString();
}

async function uploadImageToCloudinary(image) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${image.toString("base64")}`,
    {
      folder: "instalala",
      public_id: `instagram-${timestamp}`,
      resource_type: "image",
    },
  );
  return {
    url: result.secure_url,
    async cleanup() {
      const deletion = await cloudinary.uploader.destroy(result.public_id, {
        resource_type: "image",
        invalidate: true,
      });
      if (!["ok", "not found"].includes(deletion.result)) {
        throw new Error(`Réponse Cloudinary inattendue : ${deletion.result}`);
      }
    },
  };
}

async function exposeImage(config, image) {
  if (config.imageHosting === "cloudinary") return uploadImageToCloudinary(image);
  return { url: await exposeImageThroughNginx(image), cleanup: null };
}

async function assertImageIsPublic(imageUrl) {
  const response = await fetch(imageUrl, { method: "HEAD" });
  if (!response.ok) {
    throw new Error(`L'image Nginx n'est pas accessible publiquement (${response.status}) : ${imageUrl}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`L'URL publique ne renvoie pas une image (${contentType || "type inconnu"}).`);
  }
}

function instagramGraphUrl(config, resource) {
  return new URL(`https://graph.instagram.com/${config.graphVersion}/${resource}`);
}

export async function resolveInstagramAccount(config) {

  const url = instagramGraphUrl(config, "me");
  url.search = new URLSearchParams({
    fields: "user_id,username",
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
  });
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`Instagram API : ${payload.error?.message || response.statusText}`);
  }
  const accountId = payload.user_id || payload.id;
  if (!accountId) throw new Error("Instagram n'a renvoyé aucun identifiant de compte.");
  if (payload.username?.toLowerCase() !== config.expectedUsername) {
    throw new Error(`Mauvais compte Instagram : @${payload.username || "inconnu"}. Jeton attendu pour @${config.expectedUsername}.`);
  }
  if (config.instagramAccountId && String(config.instagramAccountId) !== String(accountId)) {
    throw new Error("INSTAGRAM_ACCOUNT_ID ne correspond pas au compte du jeton. Vider cette variable pour la détection automatique.");
  }
  console.log(`Compte Instagram connecté : @${payload.username || "inconnu"}`);
  return String(accountId);
}

async function graphPost(config, accountId, endpoint, params) {
  const url = instagramGraphUrl(config, `${accountId}/${endpoint}`);
  const body = new URLSearchParams({
    ...params,
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
  });
  const response = await fetch(url, { method: "POST", body });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`Instagram API : ${payload.error?.message || response.statusText}`);
  }
  return payload;
}

async function waitForContainer(config, containerId) {
  const url = instagramGraphUrl(config, containerId);
  url.search = new URLSearchParams({
    fields: "status_code,status",
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
  });

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(`Instagram API : ${payload.error?.message || response.statusText}`);
    }
    if (payload.status_code === "FINISHED") return;
    if (payload.status_code === "ERROR" || payload.status_code === "EXPIRED") {
      throw new Error(`Instagram n'a pas pu préparer le média : ${payload.status || payload.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error("Instagram n'a pas préparé le média dans le délai attendu.");
}

export async function publishOnInstagram(config, accountId, imageUrl, caption, story = false) {
  const container = await graphPost(config, accountId, "media", {
    image_url: imageUrl,
    ...(story ? { media_type: "STORIES" } : { caption }),
  });

  // Meta traite le média de façon asynchrone avant publication.
  await waitForContainer(config, container.id);
  return graphPost(config, accountId, "media_publish", { creation_id: container.id });
}

async function publishImage(config, accountId, image, caption, state, previewStamp) {
  console.log(`Exposition de l'image via ${config.imageHosting}…`);
  const hostedImage = await exposeImage(config, image);
  await assertImageIsPublic(hostedImage.url);
  console.log("Publication sur Instagram…");
  await publishBundle({
    state, imageUrl: hostedImage.url, caption, previewStamp,
    stories: config.publishStories, storyOnly,
    persist: async (nextState) => {
      if (!storyOnly) {
        await writeFile(path.join(outputDirectory, "last-post.jpg"), image);
        await writeFile(path.join(outputDirectory, "last-post.txt"), caption);
      }
      await saveState(nextState);
    },
    publish: async (url, text, story) => {
      console.log(story ? "Publication de la story…" : "Publication du post…");
      const result = await publishOnInstagram(config, accountId, url, text, story);
      console.log(`${story ? "Story" : "Post"} publié : ${result.id}`);
      return result;
    },
  });

  if (hostedImage.cleanup) {
    try {
      await hostedImage.cleanup();
      console.log("Image temporaire supprimée de Cloudinary.");
    } catch (error) {
      console.warn(`Publication réussie, mais suppression Cloudinary impossible : ${error.message}`);
    }
  }
}

async function loadExistingPreview(stamp = new Date().toISOString().slice(0, 10)) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp)) throw new Error("Date d’aperçu invalide.");
  const imagePath = path.join(outputDirectory, `${stamp}.jpg`);
  const captionPath = path.join(outputDirectory, `${stamp}.txt`);
  const [image, captionFile] = await Promise.all([
    readFile(imagePath),
    readFile(captionPath, "utf8"),
  ]);
  return { image, stamp, caption: captionFile.split("\n\nPrompt :\n", 1)[0].trim() };
}

async function main() {
  const config = getConfig();
  if (checkAccount) {
    await resolveInstagramAccount(config);
    return;
  }
  const state = await loadState();
  if (storyOnly) {
    if (!state.lastPublicationId || !state.lastPreviewStamp) throw new Error("Aucun post enregistré. Utiliser npm run publish-existing pour publier photo et story.");
    if (state.lastStoryForPost === state.lastPublicationId) {
      console.log("La story de ce post a déjà été publiée.");
      return;
    }
  }
  const due = config.schedule === "daily"
    ? dailyPublicationDue(state.lastPublishedAt)
    : publicationDue(state.lastPublishedAt, config.intervalHours);
  if (!dryRun && !storyOnly && !due) {
    console.log(config.schedule === "daily"
      ? "Publication ignorée : un post a déjà été publié aujourd’hui (Europe/Paris)."
      : `Publication ignorée : délai de ${config.intervalHours} heures non écoulé.`);
    return;
  }
  const accountId = dryRun ? null : await resolveInstagramAccount(config);

  if (publishExisting || storyOnly) {
    const existing = storyOnly ? {
      image: await readFile(path.join(outputDirectory, "last-post.jpg")),
      caption: await readFile(path.join(outputDirectory, "last-post.txt"), "utf8"),
      stamp: state.lastPreviewStamp,
    } : await loadExistingPreview();
    await publishImage(config, accountId, existing.image, existing.caption, state, existing.stamp);
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log("Création du concept et de la légende…");
  const content = await createEditorialContent(openai, config, state);
  console.log("Génération de l'image…");
  const image = await generateImage(openai, config, content.imagePrompt);
  const preview = await savePreview(image, content);
  state.history = [...state.history, content.variation].slice(-30);
  await saveState(state);

  if (dryRun) {
    console.log(`Mode simulation : aucune publication. Aperçu : ${preview.imagePath}`);
    console.log(`Légende : ${preview.captionPath}`);
    return;
  }

  await publishImage(config, accountId, image, content.caption, state, preview.stamp);
}

async function loadState() {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    if (!Array.isArray(state.history)) throw new Error("Historique invalide dans state.json.");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return { history: [], lastPublishedAt: null };
    throw error;
  }
}

async function saveState(state) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2));
  await rename(`${statePath}.tmp`, statePath);
}

async function run() {
  await mkdir(outputDirectory, { recursive: true });
  const lockPath = path.join(outputDirectory, "run.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`Exécution déjà active. Si elle a été interrompue, supprimer ${lockPath} après vérification.`);
    throw error;
  }
  try {
    await main();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
