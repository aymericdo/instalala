import { randomInt } from 'node:crypto';

const choices = {
  outfit: ['beige trench, striped top, straight jeans, loafers, shoulder bag', 'navy blazer, white tee, tailored trousers, white sneakers, tote', 'brown leather jacket, cream knit, midi skirt, ankle boots', 'grey wool coat, blue shirt, dark jeans, loafers, scarf', 'cream knit sweater, black trousers, ballet flats, crossbody bag', 'navy midi dress, denim jacket, white sneakers', 'black cardigan, white shirt, blue jeans, ankle boots', 'camel coat, striped knit, tailored trousers, loafers'],
  location: ['rue Oberkampf, 11th arrondissement', 'rue de Lancry near République', 'quai de Valmy along Canal Saint-Martin', 'rue de la Roquette near Bastille', 'rue Paul Bert, 11th arrondissement', 'rue de Bretagne in Le Marais', 'rue Montorgueil', 'rue des Batignolles', 'rue du Cherche-Midi near Saint-Germain'],
  hairstyle: ['loose wavy hair', 'messy bun', 'low bun', 'ponytail', 'half-up half-down', 'soft braid', 'tucked behind the ears', 'slightly messy natural hair'],
  pose: ['walking along the sidewalk', 'leaning against a stone wall', 'sitting at a café terrace', 'holding a takeaway coffee', 'adjusting her shoulder bag', 'pausing by a bookshop', 'looking at flowers outside a florist', 'standing beside a bicycle'],
  head: ['slightly tilted toward the camera', 'turned sideways', 'looking down softly', 'looking over her shoulder', 'chin slightly raised', 'looking directly at the camera', 'looking down the street', 'three-quarter profile'],
};

export function chooseVariation(history) {
  return Object.fromEntries(Object.entries(choices).map(([key, values]) => {
    const recent = new Set(history.slice(-(values.length - 1)).map(entry => entry[key]));
    const available = values.filter(value => !recent.has(value));
    return [key, available[randomInt(available.length)]];
  }));
}

export function publicationDue(lastPublishedAt, intervalHours, now = Date.now()) {
  if (!Number.isFinite(intervalHours) || intervalHours <= 0) throw new Error('POST_INTERVAL_HOURS doit être positif.');
  if (!lastPublishedAt) return true;
  const timestamp = Date.parse(lastPublishedAt);
  if (!Number.isFinite(timestamp)) throw new Error('Date de publication invalide dans state.json.');
  return now - timestamp >= intervalHours * 3600000;
}

export function dailyPublicationDue(lastPublishedAt, now = Date.now()) {
  if (!lastPublishedAt) return true;
  const timestamp = Date.parse(lastPublishedAt);
  if (!Number.isFinite(timestamp)) throw new Error('Date de publication invalide dans state.json.');
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return timestamp < now && date.format(timestamp) !== date.format(now);
}
