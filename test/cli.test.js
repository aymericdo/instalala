import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const exec = promisify(execFile);
const script = fileURLToPath(new URL('../src/index.js', import.meta.url));

test('scheduled publication and publish-existing skip before contacting any API', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'instalala-test-'));
  try {
    const output = path.join(cwd, 'output', 'sophie.delauney69');
    await mkdir(output, { recursive: true });
    const state = JSON.stringify({ history: [], lastPublishedAt: new Date().toISOString() });
    await writeFile(path.join(output, 'state.json'), state);
    for (const flag of ['--publish', '--publish-existing']) {
      const { stdout } = await exec(process.execPath, [script, flag], {
        cwd,
        env: {
          PATH: process.env.PATH, OPENAI_API_KEY: 'fake', INSTAGRAM_ACCESS_TOKEN: 'fake',
          IMAGE_HOSTING: 'nginx', PUBLIC_IMAGE_DIR: cwd, PUBLIC_IMAGE_BASE_URL: 'https://invalid.example/',
          POST_INTERVAL_HOURS: '48',
        },
      });
      assert.match(stdout, /Publication ignorée/);
      assert.equal(await readFile(path.join(output, 'state.json'), 'utf8'), state);
      await assert.rejects(access(path.join(output, 'run.lock')), { code: 'ENOENT' });
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
