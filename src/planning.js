export { chooseVariation } from './editorial.js';

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
