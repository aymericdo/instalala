import test from 'node:test';
import assert from 'node:assert/strict';
import { startScheduler } from '../src/scheduler.js';

test('starting the container waits until 18:00 Paris without publishing immediately', async () => {
  let calls = 0;
  const scheduler = startScheduler(async () => { calls++; });
  try {
    assert.equal(calls, 0);
    const next = scheduler.task.getNextRun();
    const time = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(next);
    assert.equal(time, '18:00');
  } finally { await scheduler.stop(); }
});

test('shutdown waits for the in-flight publication to finish', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const scheduler = startScheduler(() => {
    entered();
    return new Promise(resolve => { release = resolve; });
  });
  const execution = scheduler.task.execute();
  await started;
  let stopped = false;
  const stopping = scheduler.stop().then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  release();
  await Promise.all([execution, stopping]);
  assert.equal(stopped, true);
});
