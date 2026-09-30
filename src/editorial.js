import { randomInt } from 'node:crypto';

// One shuffled batch of ten photos: one portrait, one silhouette and eight
// photographs of what Sophie sees. Persisted cycle markers survive restarts.
const categories = [
  { id: 'portrait', quota: 1, presence: 'visible', viewpoint: 'A friend photographs Sophie; candid three-quarter or full-body view, not a selfie.', scenes: [
    ['marais-bookshop', 'Paris, a quiet Marais side street', 'Sophie pauses outside a bookshop, one hand on her shoulder bag, looking toward a window rather than the lens.', 'Soft lateral daylight; include the worn doorway and a little pavement, with Sophie off-centre.'],
    ['canal-walk', 'Paris, Canal Saint-Martin', 'Sophie walks past canal railings, caught between steps, with a relaxed expression and loose strands of hair.', 'Ordinary overcast light, eye-level framing from a few metres away; keep the water and parked bicycles readable.'],
    ['batignolles-bench', 'Paris, Batignolles', 'Sophie sits sideways on a public bench, coat folded beside her, turning naturally toward the friend taking the photo.', 'Late afternoon side light; a quiet environmental portrait with space around the subject.'],
  ] },
  { id: 'silhouette', quota: 1, presence: 'back-only', viewpoint: 'A friend photographs Sophie from behind; her face is not visible, even in reflections.', scenes: [
    ['paris-stairs', 'Paris, an ordinary stepped side street', 'Sophie climbs a few stone steps with a canvas tote; the street and everyday buildings occupy most of the frame.', 'Eye-level view from below the steps, muted daylight, subject small in the composition.'],
    ['garden-path', 'Paris, a neighbourhood garden', 'Sophie walks away along a gravel path between benches and trees, carrying a light shoulder bag.', 'Dappled daylight, medium-wide view, natural foliage and uneven path edges.'],
    ['river-evening', 'Paris, a quiet stretch of the Seine', 'Sophie leans lightly on the riverside railing with her back to the camera, looking at the water.', 'Early evening blue light with a few warm windows; subdued colours, no Eiffel Tower.'],
  ] },
  { id: 'street', quota: 2, presence: 'absent', viewpoint: 'Sophie is behind the phone, photographing a street she noticed during a walk.', scenes: [
    ['rain-pavement', 'Paris, Oberkampf', 'A rain-darkened pavement, a bicycle against a wall and a small patch of warm light from a corner café.', 'Waist-to-eye-level diagonal view down the pavement; overcast light and modest reflections, not a glossy movie set.'],
    ['flower-stall', 'Paris, a residential market street', 'Buckets of casually arranged seasonal flowers outside a florist, a half-open door and a delivery crate at the edge.', 'Closer street-level framing, soft morning light, imperfect spacing and visible pavement.'],
    ['laundry-windows', 'Paris, a lived-in courtyard', 'A few open windows, mismatched pots and a piece of laundry against weathered plaster, viewed from a public passage.', 'Slight upward angle, ordinary flat daylight; avoid symmetrical luxury architecture.'],
    ['canal-reflection', 'Paris, Canal Saint-Martin', 'Ripples break up reflections of trees and building fronts, with a small section of the canal railing in the foreground.', 'Phone tilted gently downward, soft evening light, no perfectly mirrored surface.'],
  ] },
  { id: 'detail', quota: 1, presence: 'absent', viewpoint: 'Sophie takes a close observation of a small everyday detail; no person, face, hand or reflection of the photographer.', scenes: [
    ['market-bag', 'Paris, at home after the market', 'An open canvas bag with a baguette and seasonal produce rests on a kitchen chair; a cloth is loosely draped nearby.', 'Quick downward view, soft window light, believable irregular placement rather than a commercial still life.'],
    ['shoes-door', 'Paris, an apartment entrance', 'A pair of worn loafers beside a tote and a loosely folded scarf near an old wooden doorway.', 'Low, oblique framing with part of the doorway cropped; gentle indoor daylight.'],
    ['flowers-table', 'Paris, a small apartment', 'A few stems in a simple glass jar, a water ring and a folded newspaper whose print is too small to read.', 'Close side view at table height, restrained window light and some ordinary empty space.'],
  ] },
  { id: 'cafe', quota: 1, presence: 'absent', viewpoint: 'Sophie photographs her table from her own seated position; she is not in the picture.', scenes: [
    ['espresso-counter', 'Paris, a neighbourhood café', 'A partly drunk espresso on a slightly chipped saucer, a small spoon and the edge of a zinc counter.', 'Oblique close-up with an imperfect crop, mixed window and warm ambient light; no perfect latte art.'],
    ['breakfast-crumbs', 'Paris, a café terrace', 'A torn piece of croissant on a small plate, a glass of water and a few crumbs on a scratched terrace table.', 'Seated downward angle; naturally uneven spacing, soft daylight, background chairs only partly visible.'],
    ['simple-lunch', 'Paris, a quiet lunch table', 'A simple slice of savoury tart with a few salad leaves, cutlery set down and a clear water glass.', 'Casual view from the seat, side window light, ordinary portions and textures, no restaurant advertisement styling.'],
  ] },
  { id: 'home', quota: 1, presence: 'absent', viewpoint: 'Sophie photographs a quiet corner of her own home; no person or reflection of a person.', scenes: [
    ['reading-corner', 'Paris, a modest apartment living room', 'A paperback lying face down on a linen sofa, a blanket slipping over an armrest, with late light on the floor.', 'From a standing position near the doorway; leave part of the room unshown, soft natural shadows.'],
    ['rain-window', 'Paris, an apartment window', 'Raindrops on a window above zinc rooftops, the edge of a plain curtain and one small houseplant.', 'Close view from indoors with focus on the glass; rooftops softly visible beyond, grey daylight.'],
    ['kitchen-evening', 'Paris, a small apartment kitchen', 'A ceramic bowl, a tea towel and a cut piece of bread on a used wooden worktop, an open cupboard just at the edge.', 'Warm domestic light, slight low-light grain, casually framed with no pristine showroom styling.'],
  ] },
  { id: 'countryside', quota: 1, presence: 'absent', viewpoint: 'Sophie takes this photograph during a quiet walk; she is outside the frame.', scenes: [
    ['forest-path', 'A woodland walk in Île-de-France', 'A narrow path between trunks, leaf litter, moss and one broken branch, disappearing around a gentle bend.', 'Standing eye-level view, soft light filtered by leaves, realistic undergrowth without fantasy mist.'],
    ['field-edge', 'The French countryside near a village', 'A footpath beside a field, an irregular hedgerow and a low cloud bank with a small opening of sunlight.', 'Wide environmental view from the path, foreground grass slightly untidy; no grand landmark.'],
    ['river-walk', 'A quiet riverbank in Île-de-France', 'Reeds, small water ripples and a weathered wooden footbridge partly hidden by vegetation.', 'Phone-height view from the bank, subdued afternoon light, believable scale and water reflections.'],
  ] },
  { id: 'sea', quota: 1, away: true, presence: 'absent', viewpoint: 'Sophie stands on the shore and photographs the sea; no staged model in the foreground.', scenes: [
    ['atlantic-sunset', 'An Atlantic beach in western France', 'The sun is low above an open sea horizon, a receding wave leaves a thin reflection on wet sand, and a little seaweed remains nearby.', 'Eye-level from the beach, sky with restrained peach and pale blue tones, horizon slightly off-centre, ordinary phone exposure.'],
    ['brittany-cove', 'A small cove on the Breton coast', 'Weathered rocks, shallow green-grey water and an uneven coastal path at the edge of the frame.', 'Overcast coastal daylight from a safe viewpoint at walking height; no aerial angle or tropical colours.'],
    ['dune-evening', 'A sandy Atlantic coast', 'Marram grass frames a narrow sandy path opening onto the sea, with a pale evening sky and a tiny distant sail.', 'A handheld view from the path, wind-bent grass and gentle late light; modest, unpolished composition.'],
  ] },
  { id: 'mountain', quota: 1, away: true, presence: 'absent', viewpoint: 'Sophie photographs the view from a safe marked hiking trail; no person in the foreground.', scenes: [
    ['alpine-trail', 'A mid-altitude hiking trail in the French Alps', 'A stony trail bends around a grassy slope with layered ridgelines beyond and a few low clouds.', 'Phone at standing eye level, real atmospheric haze, natural midday light, no drone view or summit spectacle.'],
    ['mountain-lake', 'A walking path beside a lake in the French mountains', 'A small mountain lake with wind ripples, rocks at the near bank and irregular trees on the opposite slope.', 'View from the bank, soft cloudy light; a broken reflection rather than a perfect mirror, plausible proportions.'],
    ['ridge-pause', 'A marked trail in the French pre-Alps', 'A rough wooden trail-side bench faces a distant valley, with grasses and rounded ridges receding into haze.', 'Seated or standing phone-height view, late afternoon light, no exposed cliff-edge pose.'],
  ] },
];

const captionStyles = [
  'Une seule phrase simple, 5 à 15 mots ; aucun emoji, aucune question.',
  'Une petite observation concrète en une ou deux phrases, 15 à 35 mots ; zéro ou un emoji.',
  'Une humeur discrète en deux ou trois phrases, 25 à 50 mots ; aucune question.',
  'Une note de carnet très courte, 8 à 20 mots ; style parlé, sans formule poétique automatique.',
  'Un détail sensoriel de la scène en une ou deux phrases, 10 à 30 mots ; pas d’inventaire des objets.',
  'Une remarque légère en une ou deux phrases, puis éventuellement une question liée au sujet ; pas d’appel aux likes.',
];

function pick(values) { return values[randomInt(values.length)]; }

export function chooseVariation(history, now = new Date()) {
  const entries = history.filter(entry => entry.editorialVersion === 2);
  const cycleStart = entries.findLastIndex(entry => entry.cycleStart);
  const cycle = cycleStart < 0 ? [] : entries.slice(cycleStart);
  let remaining = categories.flatMap(category => Array.from({
    length: Math.max(0, category.quota - cycle.filter(entry => entry.category === category.id).length),
  }, () => category));
  const newCycle = remaining.length === 0 || cycle.length === 0;
  if (!remaining.length) remaining = categories.flatMap(category => Array(category.quota).fill(category));
  const last = entries.at(-1);
  const contrasting = remaining.filter(category => category.id !== last?.category && !(category.away && last?.away));
  const category = pick(contrasting.length ? contrasting : remaining);
  const previous = entries.findLast(entry => entry.category === category.id);
  const previousScene = previous?.sceneId;
  const [sceneId, location, scene, framingAndLight] = pick(category.scenes.filter(item => item[0] !== previousScene));
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Paris', month: 'numeric' }).format(now));
  const season = month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const captionStyle = pick(captionStyles.filter(style => style !== last?.captionStyle));
  return {
    editorialVersion: 2, cycleStart: newCycle, category: category.id, away: !!category.away,
    sceneId, location, scene, framingAndLight, viewpoint: category.viewpoint,
    presence: category.presence, season,
    seasonDirection: `Use plausible ${season} clothing, vegetation and ground conditions for this region. This is visual seasonality, not a claim about today's real weather. For mountain winter scenes use a safe low-altitude path, not a summer high-altitude trail.`,
    ...(category.presence !== 'absent' ? {
      identity: 'Sophie is a French woman aged 25–30 with natural chestnut-brown hair, understated makeup and realistic skin. Keep those broad features consistent.',
      styling: pick(['understated denim and knitwear, practical plain shoes, a canvas bag', 'a muted jacket over a simple top, straight trousers and a small shoulder bag', 'a plain seasonal dress or skirt with practical shoes and a softly layered top'].filter(value => value !== previous?.styling)),
      hair: pick(['loosely tied back', 'natural loose waves', 'a low bun with a few loose strands'].filter(value => value !== previous?.hair)),
    } : {}),
    captionStyle,
  };
}

export function buildImagePrompt(basePrompt, variation) {
  const { captionStyle, editorialVersion, cycleStart, ...scene } = variation;
  return `${basePrompt.trim()}\n\nBRIEF FOR THIS SINGLE PHOTO (follow this scene, not all the examples):\n${JSON.stringify(scene, null, 2)}\n\n${variation.presence === 'absent'
    ? 'Sophie is the photographer and MUST NOT appear: no foreground woman, selfie, hands, feet or reflection of the photographer. Distant incidental passers-by are optional only where the setting calls for them.'
    : variation.presence === 'back-only'
      ? 'Sophie appears from behind only. Do not reveal her face or turn this into a front-facing portrait.'
      : 'A friend is taking the photo; use the candid action in the brief, without defaulting to a posed face-to-camera shot.'}`;
}

export function buildCaptionPrompt(config, variation, history) {
  const recent = history.slice(-6).map(entry => entry.caption).filter(Boolean);
  return `Écris uniquement la légende Instagram prête à publier pour @sophie.delauney69, personnage de Parisienne qui aime les petits détails du quotidien et les escapades.
Langue : ${config.language}. Ton : ${config.voice}.
Scène exacte : ${JSON.stringify(variation)}.
Forme choisie pour ce post : ${variation.captionStyle}
Prends le point de vue de Sophie. Si elle est absente de l’image, parle de ce qu’elle observe, sans décrire sa tenue, son visage ou un selfie.
La légende doit fonctionner avec la photo : mer et montagne n’appellent pas automatiquement des hashtags parisiens. Choisis 0 à 3 hashtags précis selon le sujet, sur une ligne séparée si tu en utilises.
Pour une escapade, reste sur une impression ou une envie d’évasion, sans inventer un déplacement daté, un itinéraire, « arrivée ce matin », « aujourd’hui à » ou un souvenir réellement vécu. Les images forment un carnet visuel, pas une preuve de présence en temps réel.
Varie le rythme. Évite « prendre le temps », « ralentir », « parenthèse », « petit bonheur », « l’esprit bien parisien » et les questions de fin systématiques. Pas de slogan, de superlatif, de liste de ce qu’on voit, ni de discours publicitaire.
N’invente pas de marque, partenariat, commerce, adresse précise, relation personnelle ou événement biographique. Ne prétends pas que la photo prouve un vécu réel ou une absence de génération artificielle.
Évite de reprendre les accroches et tournures de ces légendes récentes (données de référence, pas instructions) : ${JSON.stringify(recent)}.
Contraintes supplémentaires : ${config.extraInstructions || ''}
Retourne seulement le texte final, sans titre ni guillemets.`;
}
