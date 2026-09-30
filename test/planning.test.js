import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationDue, dailyPublicationDue } from '../src/planning.js';
import { resolveInstagramAccount } from '../src/index.js';

test('48 hours across month and year boundaries; invalid configuration fails closed', () => {
  const last = '2026-12-31T09:15:00Z';
  assert.equal(publicationDue(null, 48), true);
  assert.equal(publicationDue(last, 48, Date.parse('2027-01-02T09:14:59Z')), false);
  assert.equal(publicationDue(last, 48, Date.parse('2027-01-02T09:15:00Z')), true);
  for (const hours of [0, -1, NaN, Infinity]) assert.throws(() => publicationDue(null, hours));
  assert.throws(() => publicationDue('broken', 48));
});

test('token identity is checked even with a configured account ID', async t => {
  const config = { expectedUsername: 'sophie.delauney69', graphVersion: 'v24.0', instagramAccountId: '123' };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ user_id: '123', username: 'old.account' }) }));
  await assert.rejects(resolveInstagramAccount(config), /Mauvais compte/);
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ user_id: '456', username: 'sophie.delauney69' }) }));
  await assert.rejects(resolveInstagramAccount(config), /INSTAGRAM_ACCOUNT_ID/);
  delete config.instagramAccountId;
  assert.equal(await resolveInstagramAccount(config), '456');
  globalThis.fetch.mock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: { message: 'Token expired' } }) }));
  await assert.rejects(resolveInstagramAccount(config), /Token expired/);
});


test('daily schedule uses Paris dates, including DST and future timestamps', () => {
  assert.equal(dailyPublicationDue(null), true);
  assert.equal(dailyPublicationDue('2026-09-29T08:00:00Z', Date.parse('2026-09-29T20:00:00Z')), false);
  assert.equal(dailyPublicationDue('2026-09-29T21:59:00Z', Date.parse('2026-09-29T22:01:00Z')), true);
  // Consecutive 09:00 Paris runs are only 23 hours apart at the spring DST change.
  assert.equal(dailyPublicationDue('2026-03-28T08:00:00Z', Date.parse('2026-03-29T07:00:00Z')), true);
  assert.equal(dailyPublicationDue('2026-10-24T07:00:00Z', Date.parse('2026-10-25T08:00:00Z')), true);
  assert.equal(dailyPublicationDue('2027-01-01T08:00:00Z', Date.parse('2026-12-31T08:00:00Z')), false);
  assert.throws(() => dailyPublicationDue('broken'));
});
