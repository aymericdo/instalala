import 'dotenv/config';
import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const schedule = '0 18 * * *';
export const timezone = 'Europe/Paris';

function publish() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./index.js', import.meta.url)), '--publish'], {
      stdio: 'inherit',
      env: { ...process.env, POST_SCHEDULE: 'daily' },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Publication interrompue (${signal || code}).`)));
  });
}

export function startScheduler(run = publish) {
  let active;
  const task = cron.schedule(schedule, () => {
    active = Promise.resolve().then(run).catch(error => {
      console.error(`Échec de la publication planifiée : ${error.message}`);
    }).finally(() => { active = undefined; });
    return active;
  }, { timezone, noOverlap: true });
  console.log(`Cron actif : ${schedule}, ${timezone}. Prochain lancement : ${task.getNextRun()?.toISOString()}`);
  return {
    task,
    async stop() {
      await task.stop();
      // Let an in-flight publication finish and persist its state before exit.
      await active;
      await task.destroy();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const scheduler = startScheduler();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log('Arrêt du cron ; attente de la publication en cours si nécessaire.');
    await scheduler.stop();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
