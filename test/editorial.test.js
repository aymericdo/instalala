import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chooseVariation, buildImagePrompt, buildCaptionPrompt } from '../src/editorial.js';

const summer = new Date('2026-07-15T10:00:00Z');

test('each persisted batch includes sea, mountain and eight photos without Sophie, including after history truncation', () => {
  let history = [{ outfit: 'legacy outfit', location: 'Paris', hairstyle: 'low bun' }];
  for (let cycle = 0; cycle < 12; cycle++) {
    const batch = [];
    for (let i = 0; i < 10; i++) {
      const previous = history;
      const next = chooseVariation(history, summer);
      assert.equal(next.cycleStart, i === 0);
      assert.notEqual(next.sceneId, previous.findLast(item => item.category === next.category)?.sceneId);
      assert.notEqual(next.captionStyle, previous.at(-1)?.captionStyle);
      batch.push(next);
      history = JSON.parse(JSON.stringify([...history, next].slice(-30)));
    }
    assert.equal(batch.filter(item => item.presence === 'absent').length, 8);
    assert.equal(batch.filter(item => item.presence === 'visible').length, 1);
    assert.equal(batch.filter(item => item.presence === 'back-only').length, 1);
    assert.equal(batch.filter(item => item.category === 'sea').length, 1);
    assert.equal(batch.filter(item => item.category === 'mountain').length, 1);
    assert.equal(batch.filter(item => item.category === 'street').length, 2);
  }
});

test('brief and final prompt do not inject outfit or selfie instructions into landscapes and still lifes', async () => {
  const base = await readFile(new URL('../src/prompts/sophie.txt', import.meta.url), 'utf8');
  const history = [];
  for (let i = 0; i < 10; i++) {
    const variation = chooseVariation(history, summer);
    const prompt = buildImagePrompt(base, variation);
    assert.ok(prompt.includes(variation.scene));
    if (variation.presence === 'absent') {
      assert.equal(variation.identity, undefined);
      assert.equal(variation.styling, undefined);
      assert.equal(variation.hair, undefined);
      assert.match(prompt, /Sophie is the photographer and MUST NOT appear/);
    } else if (variation.presence === 'back-only') {
      assert.match(prompt, /Do not reveal her face/);
    }
    assert.ok(!prompt.includes(variation.captionStyle));
    history.push(variation);
  }
});

test('seasons follow the Paris calendar', () => {
  assert.equal(chooseVariation([], new Date('2026-02-28T23:30:00Z')).season, 'spring');
  assert.equal(chooseVariation([], summer).season, 'summer');
  assert.equal(chooseVariation([], new Date('2026-09-30T12:00:00Z')).season, 'autumn');
  assert.equal(chooseVariation([], new Date('2026-12-01T12:00:00Z')).season, 'winter');
});

test('caption brief includes the selected scene, editorial style and recent captions only', () => {
  const history = Array.from({ length: 9 }, (_, i) => ({ caption: `recent-caption-${i}` }));
  const variation = chooseVariation(history, summer);
  const prompt = buildCaptionPrompt({ language: 'français', voice: 'naturel' }, variation, history);
  assert.ok(prompt.includes(variation.scene));
  assert.ok(prompt.includes(variation.captionStyle));
  assert.ok(prompt.includes('recent-caption-8'));
  assert.ok(prompt.includes('recent-caption-3'));
  assert.ok(!prompt.includes('recent-caption-2'));
});
