// Starts the demo server, runs both Postman collections with Newman, then stops the server.
// Reports: CLI + JUnit (for CI) + HTML (newman-report/*.html). Exit code 1 if any assertion fails.
const { spawn } = require('child_process');
const path = require('path');
const newman = require('newman');

const ROOT = path.join(__dirname, '..');
const BASE_URL = 'http://localhost:3000';

const runs = [
  { name: 'api', collection: 'GPG-API.postman_collection.json' },
  { name: 'contact-data-driven', collection: 'GPG-contact-data-driven.postman_collection.json', data: 'contact-cases.csv' },
];

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE_URL)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Demo server did not start');
}

function run({ name, collection, data }) {
  return new Promise((resolve, reject) => {
    newman.run({
      collection: path.join(__dirname, collection),
      environment: path.join(__dirname, 'local.postman_environment.json'),
      ...(data && { iterationData: path.join(__dirname, data) }),
      reporters: ['cli', 'junit', 'htmlextra'],
      reporter: {
        junit: { export: path.join(ROOT, 'newman-report', `${name}.xml`) },
        htmlextra: { export: path.join(ROOT, 'newman-report', `${name}.html`), title: `GPG – ${name}` },
      },
    }, (err, summary) => (err ? reject(err) : resolve(summary.run.failures.length)));
  });
}

(async () => {
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], { stdio: 'ignore' });
  let failures = 0;
  try {
    await waitForServer();
    for (const r of runs) failures += await run(r);
  } finally {
    server.kill();
  }
  console.log(failures ? `\n${failures} Newman assertion(s) failed` : '\nAll Newman collections passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
