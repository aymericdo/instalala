import test from 'node:test';
import assert from 'node:assert/strict';
import { publishBundle } from '../src/publication.js';
import { publishOnInstagram } from '../src/index.js';

function setup(overrides = {}) {
  const calls = [], saved = [];
  return { calls, saved, args: {
    state: {}, imageUrl: 'https://example.com/photo.jpg', caption: 'Paris ☕', previewStamp: '2026-09-29', stories: true, storyOnly: false,
    publish: async (...args) => { calls.push(args); return { id: args[2] ? 'story-1' : 'post-1' }; },
    persist: async state => saved.push(structuredClone(state)), ...overrides,
  } };
}

test('feed and story succeed and persist separately', async () => {
  const { args, calls, saved } = setup();
  await publishBundle(args);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1], 'Paris ☕');
  assert.equal(calls[1][1], undefined);
  assert.equal(saved[0].lastStoryId, undefined);
  assert.equal(saved[1].lastStoryForPost, 'post-1');
  assert.equal(saved[0].lastPublishedAt, saved[1].lastPublishedAt);
});

test('failed story retains feed success; retry publishes story once without resetting cadence', async () => {
  const { args, saved } = setup({publish: async (_url, _caption, story) => {
    if (story) throw new Error('Permission denied');
    return { id: 'post-1' };
  }});
  await assert.rejects(publishBundle(args), /publish-story-existing/);
  assert.equal(saved.length, 1);
  assert.equal(args.state.lastPublicationId, 'post-1');
  const publishedAt = args.state.lastPublishedAt;
  let calls = 0;
  args.storyOnly = true;
  args.publish = async (_url, caption, story) => {
    assert.equal(story, true); assert.equal(caption, undefined); calls++;
    return { id: 'story-retry' };
  };
  await publishBundle(args);
  await publishBundle(args);
  assert.equal(calls, 1);
  assert.equal(args.state.lastPublishedAt, publishedAt);
});

test('feed failure never attempts story; disabled stories only publish feed', async () => {
  const failed = setup({ publish: async () => { throw new Error('feed failed'); } });
  await assert.rejects(publishBundle(failed.args), /feed failed/);
  assert.equal(failed.saved.length, 0);
  const disabled = setup({stories: false});
  await publishBundle(disabled.args);
  assert.equal(disabled.calls.length, 1);
});

test('story endpoint uses STORIES without caption and waits before publishing', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), body: options?.body });
    return { ok: true, json: async () => options?.method === 'POST'
      ? { id: requests.length === 1 ? 'container-1' : 'story-1' }
      : { status_code: 'FINISHED' } };
  });
  const result = await publishOnInstagram({graphVersion: 'v24.0'}, '123', 'https://example.com/photo.jpg', 'caption', true);
  assert.equal(result.id, 'story-1');
  assert.equal(requests[0].body.get('media_type'), 'STORIES');
  assert.equal(requests[0].body.has('caption'), false);
  assert.match(requests[1].url, /container-1/);
  assert.equal(requests[2].body.get('creation_id'), 'container-1');
});
