'use strict';
// Flusso completo dell'API su un database temporaneo: iscrizione, sessione, upload, keypoint, validazione, export, cancellazione.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'segnalis-test-'));
const server = require('../server.js');
const { exportDataset } = server;

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => { server.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

const call = async (p, { key, method = 'GET', json, body, headers = {} } = {}) => {
  const h = { ...headers };
  if (key) h.Authorization = `Bearer ${key}`;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const res = await fetch(base + p, { method, headers: h, body });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.arrayBuffer() };
};
const join = (profile, consent = {}) => call('/api/contributors', { method: 'POST', json: { consent: { age18: true, research: true, ...consent }, profile } });
const fakeWebm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(4096, 7)]);
const meta = m => Buffer.from(JSON.stringify(m)).toString('base64');

test('flusso completo', async () => {
  assert.equal((await call('/api/contributors', { method: 'POST', json: { consent: { age18: true } } })).status, 400, 'consenso ricerca obbligatorio');
  assert.equal((await join({ region: 'atlantide' })).status, 400, 'valori del profilo validati');

  const a = await join({ relation: 'udente', experience: 'under1', region: 'sicilia' }, { review: true });
  assert.equal(a.status, 201);
  assert.equal(a.body.me.canReview, false);
  const b = await join({ relation: 'sordo', region: 'lazio' });
  assert.equal(b.body.me.canReview, true);
  const A = a.body.key, B = b.body.key;

  const s = await call('/api/session?category=saluti', { key: A });
  assert.equal(s.body.prompts.length, 10);
  const pid = s.body.prompts[0].id;

  assert.equal((await call('/api/recordings', { key: A, method: 'POST', body: Buffer.from('ciao'.repeat(400)),
    headers: { 'Content-Type': 'video/webm', 'X-Segnalis-Meta': meta({ prompt_id: pid }) } })).status, 415, 'controllo del formato');

  assert.equal((await call('/api/recordings', { key: A, method: 'POST', body: Buffer.concat([fakeWebm(), Buffer.alloc(4_500_000)]),
    headers: { 'Content-Type': 'video/webm', 'X-Segnalis-Meta': meta({ prompt_id: pid }) } })).status, 413, 'limite di 4,4 MB delle funzioni Vercel');

  const up = await call('/api/recordings', { key: A, method: 'POST', body: fakeWebm(),
    headers: { 'Content-Type': 'video/webm;codecs=vp9', 'X-Segnalis-Meta': meta({ prompt_id: pid, variant: true, note: 'si usa a Catania', duration_ms: 1800, quality: { hands_ratio: 0.9 } }) } });
  assert.equal(up.status, 201);
  const id = up.body.id;
  assert.equal((await call(`/api/recordings/${id}/landmarks`, { key: A, method: 'PUT', json: { frames: [{ t: 0, hands: [] }] } })).status, 204);
  assert.equal((await call(`/api/recordings/${id}/landmarks`, { key: B, method: 'PUT', json: { frames: [] } })).status, 404, 'solo il proprietario');

  const again = await call('/api/session?category=saluti', { key: A });
  assert.ok(!again.body.prompts.some(p => p.id === pid), 'un segno già registrato non viene riproposto');

  assert.equal((await call('/api/review/next', { key: A })).status, 403, 'principianti non validano');
  const next = await call('/api/review/next', { key: B });
  assert.equal(next.body.recording.id, id);
  assert.equal(next.body.recording.region, 'Sicilia');
  assert.equal((await call(`/api/review/next?skip=${id}`, { key: B })).body.recording, null, 'salto lato client rispettato');
  assert.equal((await call(`/api/recordings/${id}/video`, { key: B })).status, 200);
  assert.equal((await call('/api/reviews', { key: B, method: 'POST', json: { recording_id: id, verdict: 'ok' } })).body.status, 'pending');

  const c = await join({ relation: 'interprete' });
  assert.equal((await call(`/api/recordings/${id}/video`, { key: c.body.key })).status, 200);
  assert.equal((await call('/api/reviews', { key: c.body.key, method: 'POST', json: { recording_id: id, verdict: 'ok' } })).body.status, 'validated');

  const st = (await call('/api/stats')).body;
  assert.equal(st.recordings, 1);
  assert.equal(st.regions.find(r => r.id === 'sicilia').n, null, 'gruppi sotto 5 persone nascosti');

  const exp = await exportDataset();
  const rows = fs.readFileSync(path.join(exp.dir, 'manifest.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].votes.ok, 2);
  assert.ok(fs.existsSync(path.join(exp.dir, rows[0].landmarks)));

  // L'eliminazione del validatore riporta il video in verifica; quella dell'autore lo cancella dal disco.
  assert.equal((await call('/api/me', { key: c.body.key, method: 'DELETE' })).status, 204);
  assert.equal((await call('/api/me/recordings', { key: A })).body[0].status, 'pending');
  assert.equal((await call('/api/me', { key: A, method: 'DELETE' })).status, 204);
  assert.equal((await call('/api/me', { key: A })).status, 401);
  assert.deepEqual(fs.readdirSync(path.join(process.env.DATA_DIR, 'videos')), []);
});

test('file statici protetti', async () => {
  assert.equal((await call('/%2e%2e/server.js')).status, 404);
  assert.equal((await call('/vendor/mediapipe/%2e%2e/%2e%2e/package.json')).status, 404);
  assert.equal((await call('/')).status, 200);
  assert.equal((await call('/vendor/mediapipe/vision_bundle.mjs')).status, 200);
});
