'use strict';
// Segnalis — server senza dipendenze: HTTP, SQLite integrato in Node, file video su disco.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const MEDIAPIPE = path.join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const VIDEOS = path.join(DATA, 'videos');
const PORT = Number(process.env.PORT || 3000);

const CONSENT_VERSION = '2026-11';
const SESSION_SIZE = 10;
const TARGET_SIGNERS = 50; // persone diverse per ogni segno
const REVIEWS_NEEDED = 2;
const K_ANON = 5; // sotto questa soglia le statistiche pubbliche mostrano "<5"
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_LANDMARKS_BYTES = 3 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;

// ——— Vocabolario ———
const VOCAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'vocabolari', 'ise.json'), 'utf8'));
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PROMPTS = new Map();
for (const c of VOCAB.categories) {
  for (const it of c.items) {
    const id = `${c.id}.${slug(it) || it}`;
    if (PROMPTS.has(id)) throw new Error(`Prompt duplicato: ${id}`);
    const gloss = c.type === 'frase' ? null : it.replace(/[?!.,]/g, '').toUpperCase();
    PROMPTS.set(id, { id, cat: c.id, it, type: c.type, gloss });
  }
}

const OPTIONS = {
  relation: { sordo: 'Sono sordo/a', coda: 'Figlio/a di genitori sordi (CODA)', interprete: 'Interprete LIS', udente: 'Udente che conosce la LIS', studente: 'Sto imparando la LIS' },
  experience: { nativo: 'Da sempre', over10: 'Più di 10 anni', '5-10': 'Da 5 a 10 anni', '1-5': 'Da 1 a 5 anni', under1: 'Meno di un anno' },
  learned: { famiglia: 'In famiglia', scuola: 'A scuola o in istituto', corso: 'A un corso LIS', comunita: 'Nella comunità sorda', altro: 'Altro' },
  region: {
    abruzzo: 'Abruzzo', basilicata: 'Basilicata', calabria: 'Calabria', campania: 'Campania', 'emilia-romagna': 'Emilia-Romagna',
    friuli: 'Friuli-Venezia Giulia', lazio: 'Lazio', liguria: 'Liguria', lombardia: 'Lombardia', marche: 'Marche', molise: 'Molise',
    piemonte: 'Piemonte', puglia: 'Puglia', sardegna: 'Sardegna', sicilia: 'Sicilia', toscana: 'Toscana', trentino: 'Trentino-Alto Adige',
    umbria: 'Umbria', 'valle-daosta': "Valle d'Aosta", veneto: 'Veneto', estero: "Fuori dall'Italia",
  },
  age: { '18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55-64': '55–64', '65+': '65 e oltre' },
  gender: { donna: 'Donna', uomo: 'Uomo', altro: 'Non binario o altro' },
  hand: { destra: 'Destra', sinistra: 'Sinistra', entrambe: 'Entrambe' },
};
const canReview = p => ['sordo', 'coda', 'interprete'].includes(p.relation) || ['nativo', 'over10', '5-10', '1-5'].includes(p.experience);

// ——— Database ———
fs.mkdirSync(VIDEOS, { recursive: true });
const db = new DatabaseSync(path.join(DATA, 'segnalis.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS contributors (
    id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL,
    consent TEXT NOT NULL, consent_version TEXT NOT NULL, profile TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY, contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    lang TEXT NOT NULL, prompt_id TEXT, text_it TEXT NOT NULL, type TEXT NOT NULL,
    variant INTEGER NOT NULL DEFAULT 0, note TEXT, file TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
    duration_ms INTEGER, width INTEGER, height INTEGER, quality TEXT, landmarks INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS rec_prompt ON recordings(prompt_id);
  CREATE INDEX IF NOT EXISTS rec_contrib ON recordings(contributor_id);
  CREATE TABLE IF NOT EXISTS reviews (
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (recording_id, reviewer_id));
  CREATE TABLE IF NOT EXISTS skips (
    contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    prompt_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (contributor_id, prompt_id));
`);
const q = sql => db.prepare(sql);

// ——— Utilità HTTP ———
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const newId = () => crypto.randomBytes(12).toString('base64url');
const hash = t => crypto.createHash('sha256').update(t).digest('hex');

// connect-src 'self' blocca anche la telemetria che MediaPipe 1.x invia a odml.pa.googleapis.com (un errore in console è atteso).
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'",
};

function send(res, status, body, headers = {}) {
  if (body === undefined) { res.writeHead(status, { ...SECURITY_HEADERS, ...headers }); return res.end(); }
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] || 0) > limit) return reject(new HttpError(413, 'File troppo grande.'));
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'File troppo grande.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  try { return JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString('utf8') || '{}'); }
  catch (e) { throw e instanceof HttpError ? e : new HttpError(400, 'Richiesta non valida.'); }
}

function auth(req, required = true) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const row = m && q('SELECT * FROM contributors WHERE token_hash = ?').get(hash(m[1].trim()));
  if (!row) return required ? fail(401, 'Chiave non valida. Accedi di nuovo.') : null;
  return { ...row, consent: JSON.parse(row.consent), profile: JSON.parse(row.profile) };
}

// ——— Validazione input ———
function cleanProfile(p = {}) {
  const out = {};
  for (const k of Object.keys(OPTIONS)) {
    if (p[k] == null || p[k] === '') continue;
    if (!Object.hasOwn(OPTIONS[k], p[k])) fail(400, `Valore non valido: ${k}.`);
    out[k] = p[k];
  }
  return out;
}
function cleanConsent(c = {}) {
  if (c.age18 !== true || c.research !== true) fail(400, 'Servono la maggiore età e il consenso alla ricerca.');
  return { age18: true, research: true, review: c.review === true, open: c.open === true, commercial: c.commercial === true };
}
const cleanText = (s, max) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const clampInt = (n, lo, hi) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : null);

function videoKind(buf, contentType = '') {
  if (contentType.startsWith('video/webm') && buf.readUInt32BE(0) === 0x1a45dfa3) return { mime: 'video/webm', ext: 'webm' };
  if (contentType.startsWith('video/mp4') && buf.toString('latin1', 4, 8) === 'ftyp') return { mime: 'video/mp4', ext: 'mp4' };
  return fail(415, 'Formato video non supportato.');
}

// ——— Logica di dominio ———
function promptCounts() {
  const m = new Map();
  for (const r of q(`SELECT prompt_id, COUNT(DISTINCT contributor_id) n FROM recordings
                     WHERE prompt_id IS NOT NULL AND status != 'rejected' GROUP BY prompt_id`).all()) m.set(r.prompt_id, r.n);
  return m;
}

function updateStatus(recId) {
  const c = { ok: 0, wrong: 0, unusable: 0 };
  for (const r of q('SELECT verdict, COUNT(*) n FROM reviews WHERE recording_id = ? GROUP BY verdict').all(recId)) c[r.verdict] = r.n;
  const neg = c.wrong + c.unusable;
  const status = c.ok >= REVIEWS_NEEDED && c.ok > neg ? 'validated' : neg >= REVIEWS_NEEDED && neg >= c.ok ? 'rejected' : 'pending';
  q('UPDATE recordings SET status = ? WHERE id = ?').run(status, recId);
  return status;
}

function meView(me) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const s = q(`SELECT COUNT(*) recordings, COALESCE(SUM(status = 'validated'), 0) validated,
               COALESCE(SUM(status = 'pending'), 0) pending, COALESCE(SUM(status = 'rejected'), 0) rejected,
               COALESCE(SUM(created_at >= ?), 0) today FROM recordings WHERE contributor_id = ?`).get(dayStart.getTime(), me.id);
  const reviews = q('SELECT COUNT(*) n FROM reviews WHERE reviewer_id = ?').get(me.id).n;
  return { id: me.id, created_at: me.created_at, consent: me.consent, profile: me.profile, canReview: canReview(me.profile), stats: { ...s, reviews } };
}

function deleteRecordingFiles(file) {
  for (const f of [file, file.replace(/\.\w+$/, '.landmarks.json')]) fs.rmSync(path.join(VIDEOS, f), { force: true });
}

function stats() {
  const t = q(`SELECT COUNT(*) recordings, COALESCE(SUM(status = 'validated'), 0) validated,
               COALESCE(SUM(duration_ms), 0) ms, COUNT(DISTINCT contributor_id) signers
               FROM recordings WHERE status != 'rejected'`).get();
  const counts = promptCounts();
  const categories = VOCAB.categories.map(c => {
    const ids = [...PROMPTS.values()].filter(p => p.cat === c.id).map(p => p.id);
    const covered = ids.filter(id => counts.has(id)).length;
    const progress = ids.reduce((a, id) => a + Math.min(counts.get(id) || 0, TARGET_SIGNERS), 0) / (ids.length * TARGET_SIGNERS);
    return { id: c.id, covered, progress };
  });
  const profiles = q('SELECT profile FROM contributors WHERE id IN (SELECT DISTINCT contributor_id FROM recordings)').all().map(r => JSON.parse(r.profile));
  const dist = key => Object.entries(OPTIONS[key]).map(([id, name]) => {
    const n = profiles.filter(p => p[key] === id).length;
    return { id, name, n: n > 0 && n < K_ANON ? null : n };
  });
  return {
    recordings: t.recordings, validated: t.validated, signers: t.signers, minutes: Math.round(t.ms / 60000),
    contributors: q('SELECT COUNT(*) n FROM contributors').get().n,
    prompts: PROMPTS.size, covered: counts.size, target: TARGET_SIGNERS,
    categories, regions: dist('region'), relations: dist('relation'), ages: dist('age'),
  };
}

// ——— API ———
const routes = [];
const on = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler });

on('GET', '/api/catalog', (req, res) => send(res, 200, {
  lang: VOCAB.lang, name: VOCAB.name, short: VOCAB.short, options: OPTIONS, consentVersion: CONSENT_VERSION,
  sessionSize: SESSION_SIZE, target: TARGET_SIGNERS,
  categories: VOCAB.categories.map(({ items, ...c }) => ({ ...c, count: items.length })),
}, { 'Cache-Control': 'no-cache' }));

on('GET', '/api/stats', (req, res) => send(res, 200, stats()));

on('POST', '/api/contributors', async (req, res) => {
  const body = await readJson(req);
  const consent = cleanConsent(body.consent);
  const profile = cleanProfile(body.profile);
  const key = crypto.randomBytes(24).toString('base64url');
  const id = newId();
  q('INSERT INTO contributors (id, token_hash, created_at, consent, consent_version, profile) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, hash(key), Date.now(), JSON.stringify(consent), CONSENT_VERSION, JSON.stringify(profile));
  send(res, 201, { key, me: meView({ id, created_at: Date.now(), consent, profile }) });
});

on('GET', '/api/me', (req, res) => send(res, 200, meView(auth(req))));

on('PATCH', '/api/me', async (req, res) => {
  const me = auth(req);
  const body = await readJson(req);
  const consent = body.consent ? cleanConsent({ ...body.consent, age18: true, research: true }) : me.consent;
  const profile = body.profile ? cleanProfile(body.profile) : me.profile;
  q('UPDATE contributors SET consent = ?, profile = ?, consent_version = ? WHERE id = ?')
    .run(JSON.stringify(consent), JSON.stringify(profile), CONSENT_VERSION, me.id);
  send(res, 200, meView({ ...me, consent, profile }));
});

on('DELETE', '/api/me', (req, res) => {
  const me = auth(req);
  const files = q('SELECT file FROM recordings WHERE contributor_id = ?').all(me.id).map(r => r.file);
  const reviewed = q('SELECT recording_id FROM reviews WHERE reviewer_id = ?').all(me.id).map(r => r.recording_id);
  q('DELETE FROM contributors WHERE id = ?').run(me.id); // cascade: video, revisioni, salti
  for (const id of reviewed) updateStatus(id); // i voti rimossi cambiano lo stato dei video altrui
  files.forEach(deleteRecordingFiles);
  send(res, 204);
});

on('GET', '/api/me/export', (req, res) => {
  const me = auth(req);
  const recordings = q(`SELECT id, prompt_id, text_it, type, variant, note, mime, bytes, duration_ms, width, height, quality, status, created_at
                        FROM recordings WHERE contributor_id = ? ORDER BY created_at`).all(me.id)
    .map(r => ({ ...r, quality: r.quality && JSON.parse(r.quality) }));
  const reviews = q('SELECT recording_id, verdict, created_at FROM reviews WHERE reviewer_id = ?').all(me.id);
  send(res, 200, { exported_at: new Date().toISOString(), contributor: { id: me.id, created_at: me.created_at, consent: me.consent, consent_version: me.consent_version, profile: me.profile }, recordings, reviews },
    { 'Content-Disposition': 'attachment; filename="segnalis-miei-dati.json"' });
});

on('GET', '/api/me/recordings', (req, res) => {
  const me = auth(req);
  send(res, 200, q(`SELECT id, prompt_id, text_it, type, variant, note, duration_ms, status, created_at,
                    (SELECT COUNT(*) FROM reviews v WHERE v.recording_id = r.id) reviews
                    FROM recordings r WHERE contributor_id = ? ORDER BY created_at DESC LIMIT 500`).all(me.id));
});

on('GET', '/api/session', (req, res, url) => {
  const me = auth(req);
  const cat = url.searchParams.get('category') || 'mix';
  if (cat !== 'mix' && !VOCAB.categories.some(c => c.id === cat)) fail(404, 'Categoria inesistente.');
  const done = new Set(q(`SELECT prompt_id FROM recordings WHERE contributor_id = ? AND prompt_id IS NOT NULL
                          UNION SELECT prompt_id FROM skips WHERE contributor_id = ?`).all(me.id, me.id).map(r => r.prompt_id));
  const counts = promptCounts();
  const prompts = [...PROMPTS.values()]
    .filter(p => (cat === 'mix' || p.cat === cat) && !done.has(p.id))
    // prima i segni con meno persone: il dataset cresce in modo bilanciato
    .map(p => [counts.get(p.id) || 0, Math.random(), p])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .slice(0, SESSION_SIZE)
    .map(x => x[2]);
  send(res, 200, { prompts });
});

on('POST', '/api/skips', async (req, res) => {
  const me = auth(req);
  const { prompt_id } = await readJson(req);
  if (!PROMPTS.has(prompt_id)) fail(404, 'Segno inesistente.');
  q('INSERT OR IGNORE INTO skips (contributor_id, prompt_id, created_at) VALUES (?, ?, ?)').run(me.id, prompt_id, Date.now());
  send(res, 204);
});

on('POST', '/api/recordings', async (req, res) => {
  const me = auth(req);
  let meta;
  try { meta = JSON.parse(Buffer.from(String(req.headers['x-segnalis-meta'] || ''), 'base64').toString('utf8')); }
  catch { fail(400, 'Metadati mancanti.'); }
  const prompt = meta.prompt_id ? PROMPTS.get(meta.prompt_id) || fail(404, 'Segno inesistente.') : null;
  const text = prompt ? prompt.it : cleanText(meta.text, 120) || fail(400, 'Scrivi il significato del segno.');
  const buf = await readBody(req, MAX_VIDEO_BYTES);
  if (buf.length < 1024) fail(400, 'Video vuoto.');
  const kind = videoKind(buf, req.headers['content-type']);
  const id = newId();
  const file = `${id}.${kind.ext}`;
  fs.writeFileSync(path.join(VIDEOS, file), buf);
  const quality = {
    brightness: clampInt(meta.quality?.brightness, 0, 255),
    hands_ratio: Number.isFinite(meta.quality?.hands_ratio) ? Math.min(1, Math.max(0, meta.quality.hands_ratio)) : null,
    two_hands_ratio: Number.isFinite(meta.quality?.two_hands_ratio) ? Math.min(1, Math.max(0, meta.quality.two_hands_ratio)) : null,
  };
  q(`INSERT INTO recordings (id, contributor_id, lang, prompt_id, text_it, type, variant, note, file, mime, bytes, duration_ms, width, height, quality, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, me.id, VOCAB.lang, prompt?.id ?? null, text, prompt?.type ?? 'libero', meta.variant ? 1 : 0, cleanText(meta.note, 200) || null,
      file, kind.mime, buf.length, clampInt(meta.duration_ms, 0, 60000), clampInt(meta.width, 0, 8192), clampInt(meta.height, 0, 8192),
      JSON.stringify(quality), Date.now());
  send(res, 201, { id, status: 'pending' });
});

// Keypoint MediaPipe Hands calcolati sul dispositivo, salvati accanto al video.
on('PUT', '/api/recordings/([\\w-]+)/landmarks', async (req, res, url, [id]) => {
  const me = auth(req);
  const rec = q('SELECT file FROM recordings WHERE id = ? AND contributor_id = ?').get(id, me.id) || fail(404, 'Video non trovato.');
  let data;
  try { data = JSON.parse((await readBody(req, MAX_LANDMARKS_BYTES)).toString('utf8')); }
  catch (e) { throw e instanceof HttpError ? e : new HttpError(400, 'Keypoint non validi.'); }
  if (!Array.isArray(data?.frames) || data.frames.length > 2000) fail(400, 'Keypoint non validi.');
  fs.writeFileSync(path.join(VIDEOS, rec.file.replace(/\.\w+$/, '.landmarks.json')), JSON.stringify(data));
  q('UPDATE recordings SET landmarks = 1 WHERE id = ?').run(id);
  send(res, 204);
});

on('DELETE', '/api/recordings/([\\w-]+)', (req, res, url, [id]) => {
  const me = auth(req);
  const rec = q('SELECT file FROM recordings WHERE id = ? AND contributor_id = ?').get(id, me.id) || fail(404, 'Video non trovato.');
  q('DELETE FROM recordings WHERE id = ?').run(id);
  deleteRecordingFiles(rec.file);
  send(res, 204);
});

on('GET', '/api/recordings/([\\w-]+)/video', (req, res, url, [id]) => {
  const me = auth(req);
  const rec = q(`SELECT r.file, r.mime, r.bytes, r.contributor_id, c.consent FROM recordings r
                 JOIN contributors c ON c.id = r.contributor_id WHERE r.id = ?`).get(id) || fail(404, 'Video non trovato.');
  const mine = rec.contributor_id === me.id;
  if (!mine && !(canReview(me.profile) && JSON.parse(rec.consent).review)) fail(403, 'Non puoi vedere questo video.');
  res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': rec.mime, 'Content-Length': rec.bytes, 'Cache-Control': 'private, no-store' });
  fs.createReadStream(path.join(VIDEOS, rec.file)).pipe(res);
});

on('GET', '/api/review/next', (req, res, url) => {
  const me = auth(req);
  const skip = (url.searchParams.get('skip') || '').split(',').filter(Boolean).slice(0, 50);
  if (!canReview(me.profile)) fail(403, 'La validazione è riservata a chi segna da almeno un anno.');
  const r = q(`SELECT r.id, r.text_it, r.type, r.variant, r.note, r.prompt_id, c.profile FROM recordings r
               JOIN contributors c ON c.id = r.contributor_id
               WHERE r.status = 'pending' AND r.contributor_id != ? AND json_extract(c.consent, '$.review') = 1
                 AND NOT EXISTS (SELECT 1 FROM reviews v WHERE v.recording_id = r.id AND v.reviewer_id = ?)
                 AND r.id NOT IN (SELECT value FROM json_each(?))
               ORDER BY (SELECT COUNT(*) FROM reviews v WHERE v.recording_id = r.id) DESC, r.created_at ASC LIMIT 1`).get(me.id, me.id, JSON.stringify(skip));
  if (!r) return send(res, 200, { recording: null });
  const region = JSON.parse(r.profile).region;
  const { profile, ...rest } = r;
  send(res, 200, { recording: { ...rest, gloss: PROMPTS.get(r.prompt_id)?.gloss ?? null, region: r.variant && region ? OPTIONS.region[region] : null } });
});

on('POST', '/api/reviews', async (req, res) => {
  const me = auth(req);
  if (!canReview(me.profile)) fail(403, 'La validazione è riservata a chi segna da almeno un anno.');
  const { recording_id, verdict } = await readJson(req);
  if (!['ok', 'wrong', 'unusable'].includes(verdict)) fail(400, 'Giudizio non valido.');
  const rec = q('SELECT contributor_id FROM recordings WHERE id = ?').get(recording_id) || fail(404, 'Video non trovato.');
  if (rec.contributor_id === me.id) fail(403, 'Non puoi validare i tuoi video.');
  q('INSERT OR REPLACE INTO reviews (recording_id, reviewer_id, verdict, created_at) VALUES (?, ?, ?, ?)').run(recording_id, me.id, verdict, Date.now());
  send(res, 200, { status: updateStatus(recording_id) });
});

// ——— File statici ———
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res, pathname) {
  let base = PUBLIC, rel = decodeURIComponent(pathname);
  if (rel.startsWith('/vendor/mediapipe/')) { base = MEDIAPIPE; rel = rel.slice('/vendor/mediapipe'.length); }
  if (rel === '/') rel = '/index.html';
  const file = path.join(base, path.normalize(rel));
  if (!file.startsWith(base + path.sep)) return send(res, 403, { error: 'Vietato.' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'Non trovato.' });
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': base === MEDIAPIPE || file.endsWith('.task') ? 'public, max-age=604800' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Metodo non consentito.' });
      return serveStatic(req, res, url.pathname);
    }
    for (const r of routes) {
      const m = r.method === req.method && r.re.exec(url.pathname);
      if (m) return await r.handler(req, res, url, m.slice(1));
    }
    send(res, 404, { error: 'Non trovato.' });
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Errore del server.' });
    else res.destroy();
  }
});

// ——— Export del dataset (da riga di comando, nessuna API pubblica) ———
function exportDataset(includePending = false) {
  const dir = path.join(DATA, 'export', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(path.join(dir, 'videos'), { recursive: true });
  const rows = q(`SELECT r.*, c.profile, c.consent, c.consent_version,
                  (SELECT json_group_object(verdict, n) FROM (SELECT verdict, COUNT(*) n FROM reviews WHERE recording_id = r.id GROUP BY verdict)) votes
                  FROM recordings r JOIN contributors c ON c.id = r.contributor_id
                  WHERE r.status = 'validated' ${includePending ? "OR r.status = 'pending'" : ''} ORDER BY r.created_at`).all();
  const lines = [];
  for (const r of rows) {
    const consent = JSON.parse(r.consent);
    const lm = r.file.replace(/\.\w+$/, '.landmarks.json');
    for (const f of r.landmarks ? [r.file, lm] : [r.file]) {
      try { fs.linkSync(path.join(VIDEOS, f), path.join(dir, 'videos', f)); } catch { fs.copyFileSync(path.join(VIDEOS, f), path.join(dir, 'videos', f)); }
    }
    const p = PROMPTS.get(r.prompt_id);
    lines.push(JSON.stringify({
      id: r.id, video: `videos/${r.file}`, landmarks: r.landmarks ? `videos/${lm}` : null, lang: r.lang,
      prompt_id: r.prompt_id, category: p?.cat ?? null, type: r.type, text_it: r.text_it, gloss: p?.gloss ?? null,
      variant: !!r.variant, note: r.note, mime: r.mime, duration_ms: r.duration_ms, width: r.width, height: r.height,
      quality: r.quality && JSON.parse(r.quality), status: r.status, votes: JSON.parse(r.votes || '{}'), created_at: new Date(r.created_at).toISOString(),
      signer: { id: r.contributor_id, ...JSON.parse(r.profile) },
      license: { research: true, open: consent.open, commercial: consent.commercial, consent_version: r.consent_version },
    }));
  }
  fs.writeFileSync(path.join(dir, 'manifest.jsonl'), lines.map(l => l + '\n').join(''));
  console.log(`Esportati ${rows.length} video in ${dir}`);
  return { dir, count: rows.length };
}

if (require.main === module) {
  if (process.argv[2] === 'export') exportDataset(process.argv.includes('--all'));
  else server.listen(PORT, () => console.log(`Segnalis in ascolto su http://localhost:${PORT}`));
}

module.exports = { server, exportDataset, PROMPTS, db };
