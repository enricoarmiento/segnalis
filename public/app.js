// Segnalis — app a pagina singola, senza framework.
const CONTACT_EMAIL = 'dataset@segnalis.it'; // da sostituire con l'indirizzo reale del progetto
const KEY = 'segnalis.key';
const DAILY_GOAL = 10;
const MEDIAPIPE_VERSION = '1.1.1';

// ——— Utilità ———
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n || 0).toLocaleString('it-IT');
const pct = p => (p > 0 && p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);
const vibrate = ms => navigator.vibrate?.(ms);
const b64 = s => { let bin = ''; new TextEncoder().encode(s).forEach(b => (bin += String.fromCharCode(b))); return btoa(bin); };
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage non disponibile */ } },
};
const TYPE_LABEL = { lettera: 'Lettera', numero: 'Numero', segno: 'Segno', frase: 'Frase', libero: 'Segno proposto' };
const TYPE_PLURAL = { lettera: 'lettere', numero: 'numeri', segno: 'segni', frase: 'frasi' };
const STATUS_LABEL = { pending: 'In verifica', validated: 'Validato', rejected: 'Scartato' };
const MAX_MS = { lettera: 4000, numero: 5000, segno: 6000, frase: 15000, libero: 10000 };
const TIPS = { lettera: 'in dattilologia', numero: 'con le mani', segno: 'come lo fai di solito', frase: 'in LIS naturale, non parola per parola', libero: 'come lo usi tu' };
const MIME = window.MediaRecorder ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t)) : null;
// Collegamenti tra i 21 punti della mano, come in MediaPipe Hands.
const CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  alfabeto: I('<path d="M3 19 8 5l5 14M5 14h6"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M20 12.5V18"/>'),
  numeri: I('<path d="M10 4 8 20M16 4l-2 16M4.5 9h15M4 15h15"/>'),
  saluti: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>'),
  persone: I('<circle cx="9.5" cy="7.5" r="3.5"/><path d="M3 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1M16.5 4a3.5 3.5 0 0 1 0 7M21 20v-1a5 5 0 0 0-3-4.6"/>'),
  emozioni: I('<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>'),
  tempo: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  domande: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.4M12 17h.01"/>'),
  cibo: I('<path d="M4 9h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V9zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>'),
  luoghi: I('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  salute: I('<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>'),
  azioni: I('<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>'),
  colori: I('<circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="14.5" r="5"/>'),
  conversazione: I('<path d="M3 4h12v9H8l-4 3v-3H3zM18 8h3v9h-1v3l-4-3h-5v-1"/>'),
  servizi: I('<path d="M4 20V8l8-5 8 5v12M9 20v-5h6v5M2 20h20"/>'),
  mix: I('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  libero: I('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  hand: I('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1.5a7 7 0 0 1-5.6-2.8l-2.6-3.6a1.6 1.6 0 0 1 2.4-2.1L8 15.5"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11"/>'),
  mute: I('<path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  wall: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/>'),
  framing: I('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17a4 4 0 0 1 8 0"/>'),
  key: I('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16 7l3 3M14 9l2 2"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  sliders: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
};

function ring(p, size = 36, stroke = 4, color) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" ${color ? `style="--ring:${color}"` : ''} aria-hidden="true">
    <circle class="track" cx="${h}" cy="${h}" r="${r}" stroke-width="${stroke}"/>
    <circle class="fill" cx="${h}" cy="${h}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, Math.max(0, p)))}" data-c="${c}" transform="rotate(-90 ${h} ${h})"/></svg>`;
}
const setRing = (svg, p) => { const f = svg?.querySelector('.fill'); if (f) f.style.strokeDashoffset = f.dataset.c * (1 - Math.min(1, p)); };

// Mano stilizzata con i 21 punti di MediaPipe, per le illustrazioni.
const HAND_POINTS = [[100, 200], [75, 185], [55, 165], [42, 145], [32, 128], [80, 130], [74, 95], [70, 72], [67, 52], [100, 125], [100, 85], [100, 60], [100, 38], [118, 130], [124, 94], [127, 72], [130, 54], [134, 140], [145, 113], [151, 96], [156, 80]];
function handArt(cls = 'keypoints') {
  const lines = CONNECTIONS.map(([a, b]) => `<line x1="${HAND_POINTS[a][0]}" y1="${HAND_POINTS[a][1]}" x2="${HAND_POINTS[b][0]}" y2="${HAND_POINTS[b][1]}"/>`).join('');
  const dots = HAND_POINTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join('');
  return `<svg class="${cls}" viewBox="20 25 150 190" aria-hidden="true"><g stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".35">${lines}</g><g fill="var(--accent)">${dots}</g></svg>`;
}

// ——— API ———
async function api(path, { method = 'GET', body, raw = false, headers = {} } = {}) {
  const h = { ...headers };
  const key = store.get(KEY);
  if (key) h.Authorization = `Bearer ${key}`;
  if (body !== undefined && !raw) { h['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const res = await fetch(path, { method, headers: h, body });
  if (res.status === 401 && key) { store.set(KEY, null); me = null; updateNav(); }
  if (!res.ok) {
    const err = new Error((await res.json().catch(() => ({}))).error || 'Connessione non riuscita. Riprova.');
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : res.blob();
}

// ——— Interfaccia comune ———
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function confirmDialog({ title, text, ok = 'Conferma', danger = false }) {
  const d = $('#dialog');
  d.innerHTML = `<form method="dialog" class="dialog-body"><h2>${esc(title)}</h2><p>${esc(text)}</p>
    <div class="dialog-actions"><button class="btn btn-secondary" value="no">Annulla</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="yes">${esc(ok)}</button></div></form>`;
  d.returnValue = '';
  d.showModal();
  return new Promise(resolve => { d.onclose = () => resolve(d.returnValue === 'yes'); });
}
function videoDialog(url, title) {
  const d = $('#dialog');
  d.innerHTML = `<form method="dialog" class="dialog-body"><video src="${url}" autoplay loop muted playsinline></video><h2>${esc(title)}</h2>
    <div class="dialog-actions one"><button class="btn btn-secondary">Chiudi</button></div></form>`;
  d.onclose = () => URL.revokeObjectURL(url);
  d.showModal();
}
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function reveal(root) {
  const els = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}
const typeCount = c => `${c.count} ${TYPE_PLURAL[c.type]}`;

// ——— Stato e router ———
let catalog = null;
let me = null;
let cleanup = null;
const app = $('#app');
const routes = { '': home, inizia: onboarding, accedi: login, registra: picker, studio, valida: review, profilo: profile, dataset, privacy };
const NEEDS_ME = new Set(['registra', 'studio', 'valida', 'profilo']);

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

async function route() {
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  cleanup?.(); cleanup = null;
  $('#nav').classList.remove('open');
  if (NEEDS_ME.has(name) && !me) return go('#/inizia');
  const view = Object.hasOwn(routes, name) ? routes[name] : home;
  document.body.dataset.view = name || 'home';
  updateNav(name);
  app.innerHTML = '';
  window.scrollTo(0, 0);
  try {
    cleanup = (await view(app, arg)) || null;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="page center"><h1 class="title">Qualcosa non ha funzionato.</h1><p class="lead mt-2">${esc(e.message)}</p><div class="row mt-3"><button class="btn btn-primary" id="retry">Riprova</button></div></div>`;
    $('#retry').onclick = route;
  }
  reveal(app);
  if (name) app.focus({ preventScroll: true });
}

function updateNav(name = location.hash.replace(/^#\/?/, '').split('/')[0]) {
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current', a.dataset.nav === name));
  $('.nav-account').hidden = !me;
  const cta = $('.nav-cta');
  cta.textContent = me ? 'Registra' : 'Inizia';
  cta.href = me ? '#/registra' : '#/inizia';
}

// ——— Coda di invio: i video partono in background, con nuovi tentativi ———
const uploads = { queue: [], busy: false };
function enqueue(job) { uploads.queue.push(job); pump(); }
function renderUploads() {
  const el = $('#uploads');
  if (el) el.textContent = uploads.queue.length ? `Invio ${uploads.queue.length}…` : '';
}
async function pump() {
  renderUploads();
  if (uploads.busy || !uploads.queue.length) return;
  uploads.busy = true;
  const job = uploads.queue[0];
  try {
    if (!job.id) {
      job.id = (await api('/api/recordings', { method: 'POST', raw: true, body: job.blob,
        headers: { 'Content-Type': job.blob.type, 'X-Segnalis-Meta': b64(JSON.stringify(job.meta)) } })).id;
    }
    if (job.landmarks) await api(`/api/recordings/${job.id}/landmarks`, { method: 'PUT', body: job.landmarks });
    uploads.queue.shift();
  } catch (e) {
    job.tries = (job.tries || 0) + 1;
    if ([400, 401, 404, 413, 415].includes(e.status) || job.tries >= 5) {
      uploads.queue.shift();
      toast(`Un video non è stato inviato: ${e.message}`);
    } else await sleep(1500 * job.tries);
  }
  uploads.busy = false;
  pump();
}
addEventListener('beforeunload', e => { if (uploads.queue.length) { e.preventDefault(); e.returnValue = ''; } });

// ——— MediaPipe Hands: caricato in locale, eseguito sul dispositivo ———
let handsPromise = null;
function loadHands() {
  handsPromise ||= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('/vendor/mediapipe/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
    const make = delegate => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2,
    });
    try { return await make('GPU'); } catch { return await make('CPU'); }
  })().catch(e => { handsPromise = null; throw e; });
  return handsPromise;
}

// ——— Home ———
async function home(el) {
  const start = me ? '#/registra' : '#/inizia';
  el.innerHTML = `
  <section class="hero">
    <p class="eyebrow">Lingua dei Segni Italiana</p>
    <h1 class="display">Mani che parlano.<br>Tecnologia che capisce.</h1>
    <p class="lead">Registra i tuoi segni con la fotocamera. Insieme costruiamo il grande dataset aperto della LIS, per un'intelligenza artificiale che includa davvero tutti.</p>
    <div class="row"><a class="btn btn-primary btn-lg" href="${start}">Inizia a contribuire</a><button class="link" type="button" data-scroll="#come">Scopri come</button></div>
    <div class="device-wrap reveal">${deviceMock()}</div>
  </section>

  <section class="section section-narrow center reveal">
    <p class="statement">Ogni segno conta. <span>Le macchine capiscono decine di lingue parlate. La LIS, riconosciuta dalla Repubblica nel 2021, merita lo stesso. Per insegnarla servono migliaia di mani diverse. Anche le tue.</span></p>
  </section>

  <section class="section center" id="come">
    <p class="eyebrow">Come funziona</p>
    <h2 class="headline">Pochi secondi.<br>Un segno che resta.</h2>
    <div class="steps reveal">
      <div class="step"><h3>Leggi.</h3><p>Ti mostriamo una parola, una lettera o una frase in italiano.</p></div>
      <div class="step"><h3>Segna.</h3><p>Registri pochi secondi con la fotocamera del telefono o del computer. Nessuna app da installare.</p></div>
      <div class="step"><h3>Fatto.</h3><p>La comunità verifica il video. Poi entra nel dataset che addestra i modelli di domani.</p></div>
    </div>
  </section>

  <section class="band"><div class="section">
    <div class="center"><p class="eyebrow">Pensato per chi segna</p><h2 class="headline">Tutto quello che serve.<br>Niente di più.</h2></div>
    <div class="bento reveal">
      <div class="tile tile-wide"><h3>Vede le tue mani.<br>In tempo reale.</h3><p>MediaPipe Hands riconosce 21 punti per ogni mano direttamente sul tuo dispositivo, e ti avvisa se escono dall'inquadratura. Quei punti entrano nel dataset insieme al video.</p>${handArt()}</div>
      <div class="tile tile-wide tile-dark"><h3>Anelli da chiudere.</h3><p>Dieci segni, un anello. Una sessione dura meno di un caffè.</p><div class="tile-art center">${ring(0.7, 140, 16, '#ff3b30')}</div></div>
      <div class="tile"><h3>Dalla A alla Z.</h3><p>La dattilologia completa, lettera per lettera.</p><div class="tile-art alphabet">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').slice(0, 18).map((l, k) => `<span class="${[2, 8, 11, 17].includes(k) ? 'on' : ''}">${l}</span>`).join('')}</div></div>
      <div class="tile"><h3>Ogni regione.<br>Ogni accento.</h3><p>La LIS di Palermo non è quella di Torino. Segnala le varianti: le vogliamo tutte.</p><div class="tile-art regions">${['Sicilia', 'Piemonte', 'Lazio', 'Veneto', 'Puglia', 'Sardegna', 'Toscana', 'Campania'].map((r, k) => `<span class="${k % 3 === 0 ? 'on' : ''}">${r}</span>`).join('')}</div></div>
      <div class="tile"><h3>I segni che contano di più.</h3><p>Un vocabolario dedicato a salute ed emergenze, per servizi davvero accessibili.</p><div class="big" style="color:var(--red)">Aiuto.</div></div>
      <div class="tile tile-full tile-split"><div><h3>Verificato dalla comunità sorda.</h3><p>Ogni video viene controllato da almeno due persone che segnano da anni. Così il dataset è affidabile, non solo grande.</p></div>
        <div class="checks" aria-hidden="true"><span>${ICONS.check}</span><span>${ICONS.check}</span></div></div>
    </div>
  </div></section>

  <section class="dark"><div class="section center">
    <p class="eyebrow">Privacy</p>
    <h2 class="headline">Privacy.<br>Nelle tue mani.</h2>
    <p class="lead mt-3">Nella LIS il volto è grammatica: per questo i video lo mostrano. E per questo li proteggiamo come meritano.</p>
    <div class="promises reveal" style="text-align:left">
      <div class="promise">${ICONS.key}<h3>Nessun nome, nessuna email.</h3><p>Ricevi una chiave anonima. Nient'altro.</p></div>
      <div class="promise">${ICONS.mute}<h3>Solo video. Mai audio.</h3><p>Il microfono resta spento. Sempre.</p></div>
      <div class="promise">${ICONS.sliders}<h3>Consensi chiari, uno per uno.</h3><p>Scegli tu chi può usare i tuoi video: ricerca, enti esterni, aziende.</p></div>
      <div class="promise">${ICONS.trash}<h3>Cancelli tutto con un tocco.</h3><p>Video, punti delle mani, profilo. Quando vuoi.</p></div>
    </div>
    <p class="mt-4"><a class="link" href="#/privacy">Leggi l'informativa</a></p>
  </div></section>

  <section class="section center">
    <p class="eyebrow">Fatto in Italia. Pensato per il mondo.</p>
    <h2 class="headline">Partiamo dalla LIS.<br>Non ci fermiamo qui.</h2>
    <p class="lead mt-3">Lo stesso metodo funziona per ogni lingua dei segni. Quando il dataset italiano sarà solido, apriremo alle altre comunità.</p>
    <div class="langs reveal">
      <div class="lang on"><b>LIS</b><span>Italia · Attiva</span></div>
      ${[['ASL', 'Stati Uniti'], ['BSL', 'Regno Unito'], ['LSF', 'Francia'], ['DGS', 'Germania'], ['LSE', 'Spagna']].map(([l, c]) => `<div class="lang"><b>${l}</b><span>${c} · Presto</span></div>`).join('')}
    </div>
  </section>

  <section class="band"><div class="section center">
    <p class="eyebrow">In diretta</p>
    <h2 class="headline">Il dataset, oggi.</h2>
    <div class="ribbon" id="ribbon"><div class="spinner"></div></div>
  </div></section>

  <section class="section center">
    <h2 class="display">Il tuo primo segno<br>ti aspetta.</h2>
    <div class="row mt-4"><a class="btn btn-primary btn-lg" href="${start}">Inizia ora</a></div>
    <p class="tiny mt-2">Servono una fotocamera e due minuti.</p>
  </section>`;

  el.querySelector('[data-scroll]').onclick = e => $(e.currentTarget.dataset.scroll).scrollIntoView({ behavior: 'smooth' });
  api('/api/stats').then(s => { const r = $('#ribbon'); if (r) r.innerHTML = metrics(s); }).catch(() => $('#ribbon')?.remove());

  const words = ['Grazie', 'Casa', 'Amico', 'Domani', 'Aiuto', 'Come stai?'];
  let k = 0;
  const timer = setInterval(() => {
    const w = $('#mock-word');
    if (!w) return;
    w.classList.add('swap');
    setTimeout(() => { w.textContent = words[(k = (k + 1) % words.length)]; w.classList.remove('swap'); }, 400);
  }, 2600);
  return () => clearInterval(timer);
}

function deviceMock() {
  const hand = cls => `<g class="mock-hand ${cls}"><g stroke="#2997ff" stroke-width="2" stroke-linecap="round">
    <line x1="0" y1="0" x2="-11" y2="-20"/><line x1="0" y1="0" x2="-3" y2="-25"/><line x1="0" y1="0" x2="5" y2="-24"/><line x1="0" y1="0" x2="11" y2="-19"/><line x1="0" y1="0" x2="15" y2="-5"/></g>
    <g fill="#f5f5f7"><circle r="3.5"/><circle cx="-11" cy="-20" r="2.4"/><circle cx="-3" cy="-25" r="2.4"/><circle cx="5" cy="-24" r="2.4"/><circle cx="11" cy="-19" r="2.4"/><circle cx="15" cy="-5" r="2.4"/></g></g>`;
  return `<div class="device" aria-hidden="true"><div class="device-screen">
    <div class="mock-top">${ring(0.3, 22, 3, '#30d158')}<span>3 di 10</span></div>
    <div class="mock-stage"><span class="mock-chip"><i></i>Due mani visibili</span>
      <svg viewBox="0 0 200 260" preserveAspectRatio="xMidYMax slice">
        <ellipse cx="100" cy="92" rx="30" ry="36" fill="#48484a"/>
        <path d="M24 260c0-70 34-98 76-98s76 28 76 98z" fill="#48484a"/>
        <g transform="translate(128 214)">${hand('mock-hand-r')}</g>
        <g transform="translate(70 222) scale(-1 1)">${hand('mock-hand-l')}</g>
      </svg></div>
    <div class="mock-card"><small>Segno · come lo fai di solito</small><strong id="mock-word">Grazie</strong></div>
    <div class="mock-shutter"></div>
  </div></div>`;
}

function metrics(s) {
  return [[fmt(s.recordings), 'video registrati'], [fmt(s.signers), 'persone che segnano'], [`${fmt(s.covered)}/${fmt(s.prompts)}`, 'segni con almeno un video'], [fmt(s.minutes), 'minuti di LIS']]
    .map(([b, l]) => `<div class="metric"><b>${b}</b><span>${l}</span></div>`).join('');
}

// ——— Consensi e profilo (condivisi tra onboarding e profilo) ———
const CONSENTS = [
  { k: 'age18', req: true, t: 'Ho almeno 18 anni', d: 'Per ora possono partecipare solo persone maggiorenni.' },
  { k: 'research', req: true, t: 'Ricerca e addestramento', d: "I miei video, che mostrano volto e mani, e i punti delle mani calcolati sul mio dispositivo possono essere usati per creare modelli che riconoscono e traducono la LIS." },
  { k: 'review', t: 'Validazione dalla comunità', d: 'Altri volontari esperti possono guardare i miei video per verificarli. Senza questo consenso i video restano utili, ma più lenti da validare.' },
  { k: 'open', t: 'Condivisione con la ricerca', d: 'I miei video possono essere condivisi con università ed enti di ricerca esterni, con accordi che vietano altri usi.' },
  { k: 'commercial', t: 'Prodotti accessibili', d: 'I miei video possono essere usati anche da aziende per sviluppare prodotti e servizi accessibili.' },
];
function consentRows(consent, locked = false) {
  return CONSENTS.map(c => `<div class="list-row"><div class="grow"><h4>${c.t}${c.req ? '' : ' <span class="tiny">Facoltativo</span>'}</h4><p>${c.d}</p></div>
    <label class="switch"><input type="checkbox" data-consent="${c.k}" ${consent[c.k] ? 'checked' : ''} ${locked && c.req ? 'disabled' : ''} aria-label="${esc(c.t)}"><span></span></label></div>`).join('');
}
const QUESTIONS = [
  ['relation', 'Qual è il tuo rapporto con la LIS?'],
  ['experience', 'Da quanto tempo segni?'],
  ['learned', 'Dove hai imparato?'],
  ['region', 'In quale regione hai imparato a segnare?', 'Ci aiuta a raccogliere le varianti regionali.'],
  ['age', "Fascia d'età"],
  ['gender', 'Genere'],
  ['hand', 'Mano dominante'],
];
function profileFields(profile) {
  return QUESTIONS.map(([k, label, hint]) => {
    const opts = catalog.options[k];
    if (k === 'region') {
      return `<div class="field"><label for="f-region">${label}</label><select class="select" id="f-region" name="region">
        <option value="">Preferisco non dirlo</option>${Object.entries(opts).map(([v, n]) => `<option value="${v}" ${profile[k] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select><p class="hint">${hint}</p></div>`;
    }
    const pills = [...Object.entries(opts), ['', 'Preferisco non dirlo']].map(([v, n]) =>
      `<label><input type="radio" name="${k}" value="${v}" ${(profile[k] ?? '') === v ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('');
    return `<fieldset class="field"><legend>${label}</legend><div class="pills">${pills}</div></fieldset>`;
  }).join('');
}
const readProfile = form => Object.fromEntries([...new FormData(form)].filter(([, v]) => v));

// ——— Onboarding ———
async function onboarding(el) {
  if (me) return go('#/registra');
  const draft = { consent: Object.fromEntries(CONSENTS.map(c => [c.k, false])), profile: {} };
  let key = null;
  const dots = n => `<div class="setup-dots" aria-hidden="true">${[0, 1, 2, 3].map(k => `<i class="${k === n ? 'on' : ''}"></i>`).join('')}</div>`;
  const show = html => { el.innerHTML = `<div class="setup">${html}</div>`; window.scrollTo(0, 0); };

  function welcome() {
    show(`${dots(0)}<div class="setup-head"><div class="setup-icon">${ICONS.hand}</div><h1 class="headline">Ti diamo il benvenuto.</h1>
      <p class="lead">Ci vogliono due minuti per iniziare. Poi ogni segno richiede pochi secondi.</p></div>
      <div class="features">
        <div class="feature">${ICONS.framing}<div><h3>Ti serve solo una fotocamera.</h3><p>Quella del telefono o del computer. Funziona nel browser.</p></div></div>
        <div class="feature">${ICONS.key}<div><h3>Nessun account.</h3><p>Niente nome, email o password. Ricevi una chiave anonima.</p></div></div>
        <div class="feature">${ICONS.shield}<div><h3>Decidi tu.</h3><p>Scegli come usare i tuoi video e cancellali quando vuoi.</p></div></div>
      </div>
      <div class="setup-actions"><button class="btn btn-primary btn-lg" id="next">Continua</button><a class="link" href="#/accedi">Hai già una chiave? Accedi</a></div>`);
    $('#next').onclick = consents;
  }

  function consents() {
    show(`${dots(1)}<div class="setup-head"><h1 class="headline">I tuoi consensi.</h1>
      <p class="lead">I primi due servono per partecipare. Gli altri sono facoltativi e puoi cambiarli quando vuoi.</p></div>
      <div class="list">${consentRows(draft.consent)}</div>
      <p class="hint">Leggi l'<a href="#/privacy" target="_blank">informativa completa</a>. I video mostrano il tuo volto: è un dato biometrico, per questo ti chiediamo un consenso esplicito.</p>
      <div class="setup-actions"><button class="btn btn-primary btn-lg" id="next">Accetto e continuo</button><button class="link link-plain" id="back">Indietro</button></div>`);
    const next = $('#next');
    const sync = () => { next.disabled = !(draft.consent.age18 && draft.consent.research); };
    el.querySelectorAll('[data-consent]').forEach(i => i.onchange = () => { draft.consent[i.dataset.consent] = i.checked; sync(); });
    sync();
    next.onclick = profileStep;
    $('#back').onclick = welcome;
  }

  function profileStep() {
    show(`${dots(2)}<div class="setup-head"><h1 class="headline">Raccontaci di te.</h1>
      <p class="lead">Tutte le risposte sono facoltative. Ci aiutano a costruire un dataset che rappresenti davvero chi segna.</p></div>
      <form id="pf">${profileFields(draft.profile)}
      <div class="setup-actions"><button class="btn btn-primary btn-lg" type="submit">Crea il mio spazio</button><button class="link link-plain" type="button" id="back">Indietro</button></div></form>`);
    $('#back').onclick = () => { draft.profile = readProfile($('#pf')); consents(); };
    $('#pf').onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter; btn.disabled = true;
      draft.profile = readProfile(e.target);
      try {
        const r = await api('/api/contributors', { method: 'POST', body: draft });
        store.set(KEY, r.key); me = r.me; key = r.key; updateNav('inizia');
        ready();
      } catch (err) { toast(err.message); btn.disabled = false; }
    };
  }

  function ready() {
    show(`${dots(3)}<div class="setup-head"><h1 class="headline">Prepara la scena.</h1><p class="lead">Quattro accorgimenti per video perfetti.</p></div>
      <div class="features">
        <div class="feature">${ICONS.sun}<div><h3>Luce davanti a te.</h3><p>Una finestra o una lampada di fronte, mai alle spalle.</p></div></div>
        <div class="feature">${ICONS.wall}<div><h3>Sfondo semplice.</h3><p>Una parete chiara e uniforme è perfetta.</p></div></div>
        <div class="feature">${ICONS.framing}<div><h3>Dalla testa alla vita.</h3><p>Appoggia il telefono, in verticale o in orizzontale. Volto e mani sempre visibili.</p></div></div>
        <div class="feature">${ICONS.hand}<div><h3>Mani a riposo.</h3><p>Inizia e finisci ogni segno con le mani ferme, in basso.</p></div></div>
      </div>
      <h2 class="group-title">La tua chiave personale</h2>
      <div class="key-box"><code>${esc(key)}</code><button class="btn btn-secondary btn-sm" id="copy">Copia</button></div>
      <p class="hint">È l'unico modo per accedere da un altro dispositivo o per cancellare i tuoi dati. Conservala in un posto sicuro.</p>
      <div class="setup-actions"><a class="btn btn-primary btn-lg" href="#/registra">Apri lo studio</a></div>`);
    $('#copy').onclick = () => navigator.clipboard?.writeText(key).then(() => toast('Chiave copiata.'), () => toast('Copia non riuscita: selezionala a mano.'));
  }

  welcome();
}

async function login(el) {
  el.innerHTML = `<div class="setup"><div class="setup-head"><div class="setup-icon">${ICONS.key}</div><h1 class="headline">Rieccoti.</h1>
    <p class="lead">Inserisci la chiave personale che hai ricevuto la prima volta.</p></div>
    <form id="lf"><div class="field"><label for="k">La tua chiave</label><input class="input" id="k" autocomplete="off" autocapitalize="off" spellcheck="false" required></div>
    <div class="setup-actions"><button class="btn btn-primary btn-lg">Accedi</button><a class="link" href="#/inizia">Non hai una chiave? Inizia</a></div></form></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    store.set(KEY, $('#k').value.trim());
    try { me = await api('/api/me'); go('#/registra'); }
    catch { store.set(KEY, null); toast('Chiave non riconosciuta.'); }
  };
}

// ——— Scelta della categoria ———
function todayBlock() {
  const t = me.stats.today;
  return `<div class="today">${ring(t / DAILY_GOAL, 64, 8, '#ff3b30')}<div><b>${Math.min(t, 99)} di ${DAILY_GOAL}</b><div class="small muted">segni oggi</div></div></div>`;
}

async function picker(el) {
  const [fresh, st] = await Promise.all([api('/api/me'), api('/api/stats')]);
  me = fresh;
  const prog = Object.fromEntries(st.categories.map(c => [c.id, c]));
  el.innerHTML = `<div class="page">
    <div class="page-head split-head"><div><h1 class="headline">Cosa segniamo oggi?</h1>
      <p class="lead">Scegli una categoria. Ti proponiamo prima i segni di cui il dataset ha più bisogno.</p></div>${todayBlock()}</div>
    <div class="cats">
      <a class="cat cat-feature" href="#/studio/mix"><span class="badge badge-lg">${ICONS.mix}</span>
        <div class="grow"><h3>Mix consigliato</h3><p>Dieci segni da categorie diverse, scelti dove servono di più.</p></div><span class="btn btn-primary">Inizia</span></a>
      ${catalog.categories.map(c => `<a class="cat" href="#/studio/${c.id}" style="--c:${c.color}"><span class="badge">${ICONS[c.id] || ICONS.hand}</span>
        <div><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></div>
        <div class="meta-wrap"><div class="bar" style="--p:${prog[c.id]?.progress || 0}"><i></i></div><div class="meta mt-1"><span>${typeCount(c)}</span><span>${pct(prog[c.id]?.progress || 0)} dell'obiettivo</span></div></div></a>`).join('')}
      <a class="cat" href="#/studio/libero" style="--c:#8e8e93"><span class="badge">${ICONS.libero}</span>
        <div><h3>Proponi tu</h3><p>Un segno che non trovi qui? Registralo e scrivi cosa significa.</p></div><div class="meta"><span>Libero</span></div></a>
    </div></div>`;
}

// ——— Studio di registrazione ———
async function studio(el, cat = 'mix') {
  const isFree = cat === 'libero';
  if (!isFree && cat !== 'mix' && !catalog.categories.some(c => c.id === cat)) return go('#/registra');

  let prompts = [], i = 0, phase = 'loading', stream = null, recorder = null, chunks = [];
  let blob = null, blobUrl = null, t0 = 0, dur = 0, recorded = 0, stopped = false, warn = '';
  let hands = null, raf = 0, lastFrameTime = -1, lastLight = 0, brightness = null, track = null, take = null;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const sessionStart = Date.now();

  el.innerHTML = `<div class="studio">
    <div class="studio-top">
      <button class="icon-btn" data-act="close" aria-label="Chiudi lo studio">${ICONS.close}</button>
      <div class="grow" id="progress"></div>
      <div class="uploads" id="uploads" aria-live="polite"></div>
    </div>
    <div class="stage">
      <div class="frame" id="frame">
        <video id="live" playsinline muted autoplay></video>
        <video id="playback" playsinline muted loop hidden></video>
        <canvas id="overlay"></canvas>
        <svg class="guide" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="50" cy="36" rx="11" ry="14"/><path d="M14 100C14 74 30 60 50 60s36 14 36 40"/></svg>
        <div class="chips">
          <span class="chip rec" id="chip-rec" hidden><i></i><span></span></span>
          <span class="chip" id="chip-light" hidden><i></i><span></span></span>
          <span class="chip" id="chip-hands" hidden><i></i><span></span></span>
        </div>
        <div class="countdown" id="countdown" aria-live="assertive"></div>
        <div class="timebar" id="timebar"></div>
      </div>
      <div class="stage-msg" id="msg" hidden></div>
    </div>
    <div class="panel" id="panel"></div>
    <div class="done" id="done" hidden></div>
  </div>`;
  const [frame, live, playback, canvas, panel, msg] = ['#frame', '#live', '#playback', '#overlay', '#panel', '#msg'].map(s => $(s, el));
  const ctx = canvas.getContext('2d');
  const light = Object.assign(document.createElement('canvas'), { width: 32, height: 24 }).getContext('2d', { willReadFrequently: true });
  renderUploads();

  function setChip(id, state, text) {
    const c = $(`#${id}`, el);
    if (!c) return;
    c.hidden = !state;
    if (!state || (c.dataset.s === state && c.dataset.t === text)) return;
    c.className = `chip ${state}`; c.dataset.s = state; c.dataset.t = text;
    c.lastElementChild.textContent = text;
  }
  function showMsg(title, text, action) {
    msg.hidden = false;
    msg.innerHTML = `<div><h2>${esc(title)}</h2><p>${esc(text)}</p>${action ? `<button class="btn btn-primary" data-act="${action[0]}">${esc(action[1])}</button>` : ''}</div>`;
  }

  function renderTop() {
    const n = prompts.length;
    $('#progress', el).innerHTML = n && !isFree ? `${ring(i / n, 26, 3.5, '#ff3b30')}<span>${Math.min(i + 1, n)} di ${n}</span>` : isFree ? '<span>Proponi un segno</span>' : '';
  }

  function renderPanel() {
    const hadFocus = panel.contains(document.activeElement);
    if (phase === 'compose') {
      panel.innerHTML = `<form class="prompt" id="compose" style="flex-wrap:wrap"><div class="grow"><small>Cosa significa il segno che vuoi proporre?</small>
        <input class="input mt-1" id="free" maxlength="120" placeholder="Es. «Cassata» oppure «Ci vediamo in piazza»" style="background:#2c2c2e;border-color:#3a3a3c;color:#f5f5f7" required></div>
        <button class="btn btn-primary" style="margin-left:auto">Continua</button></form>`;
      $('#compose', panel).onsubmit = e => { e.preventDefault(); prompts = [{ id: null, it: $('#free', panel).value.trim(), type: 'libero' }]; setPhase('idle'); };
      $('#free', panel).focus();
      return;
    }
    const p = prompts[i];
    if (!p) { panel.innerHTML = ''; return; }
    const gloss = p.gloss && p.type === 'segno' ? `<span class="gloss">${esc(p.gloss)}</span>` : '';
    if (phase === 'review') {
      panel.innerHTML = `${warn ? `<p class="warnline">${esc(warn)}</p>` : ''}
        <div class="prompt ${p.type}"><div class="grow"><small>${TYPE_LABEL[p.type]}</small><strong>${esc(p.it)}</strong></div></div>
        ${p.id ? `<div class="variant"><div class="grow">È una variante regionale o un segno diverso dal solito?<input class="input" id="note" maxlength="200" placeholder="Nota facoltativa, es. «si usa a Napoli»" hidden></div>
          <label class="switch"><input type="checkbox" id="variant" aria-label="Variante regionale"><span></span></label></div>` : ''}
        <div class="review-actions"><button class="btn btn-secondary" data-act="redo">Rifai</button><button class="btn btn-primary" data-act="use">Usa questo video</button></div>`;
      const v = $('#variant', panel);
      if (v) v.onchange = () => { $('#note', panel).hidden = !v.checked; };
      if (hadFocus) $('[data-act=use]', panel).focus();
      return;
    }
    const recording = phase === 'recording';
    const busy = phase !== 'idle';
    panel.innerHTML = `<div class="prompt ${p.type}"><div class="grow"><small>${TYPE_LABEL[p.type]} · ${TIPS[p.type]}</small><strong>${esc(p.it)}</strong>${gloss}</div></div>
      <div class="controls">
        <button class="ghost" data-act="skip" ${busy ? 'disabled' : ''}>Salta</button>
        <button class="shutter ${recording ? 'on' : ''}" data-act="shutter" aria-label="${recording ? 'Ferma la registrazione' : phase === 'countdown' ? 'Annulla' : 'Registra'}" ${phase === 'loading' ? 'disabled' : ''}></button>
        <button class="ghost" data-act="unknown" ${busy ? 'disabled' : ''} ${p.id ? '' : 'hidden'}>Non lo conosco</button>
      </div>`;
    if (hadFocus) $('[data-act=shutter]', panel).focus();
  }

  function setPhase(p) {
    phase = p;
    frame.classList.toggle('recording', p === 'recording');
    frame.classList.toggle('reviewing', p === 'review');
    live.hidden = p === 'review';
    playback.hidden = p !== 'review';
    if (p !== 'review') { playback.pause(); playback.removeAttribute('src'); }
    if (p !== 'recording') { $('#timebar', el).classList.remove('run'); setChip('chip-rec'); }
    if (p !== 'countdown') $('#countdown', el).innerHTML = '';
    renderTop();
    renderPanel();
  }

  // Fotocamera
  async function startCamera() {
    msg.hidden = true;
    if (!navigator.mediaDevices?.getUserMedia) return showMsg('Serve una connessione sicura.', 'Apri Segnalis da un indirizzo https:// per usare la fotocamera.');
    if (!MIME) return showMsg('Browser non supportato.', 'Aggiorna il browser oppure usa una versione recente di Safari, Chrome o Firefox.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
    } catch (e) {
      const denied = e.name === 'NotAllowedError';
      return showMsg(denied ? 'Consenti la fotocamera.' : 'Fotocamera non disponibile.',
        denied ? "Tocca l'icona accanto all'indirizzo, consenti l'accesso alla fotocamera e riprova." : 'Collega una fotocamera o chiudi le altre app che la stanno usando.', ['retry', 'Riprova']);
    }
    if (stopped) return stream.getTracks().forEach(t => t.stop());
    live.srcObject = stream;
    await live.play().catch(() => {});
    return true;
  }
  const fitFrame = () => { if (live.videoWidth) frame.style.setProperty('--ar', (live.videoWidth / live.videoHeight).toFixed(4)); };
  live.addEventListener('loadedmetadata', fitFrame);
  live.addEventListener('resize', fitFrame);

  // Analisi per fotogramma: luce e mani
  function checkLight() {
    light.drawImage(live, 0, 0, 32, 24);
    const d = light.getImageData(0, 0, 32, 24).data;
    let all = 0, mid = 0, nm = 0;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
      const o = (y * 32 + x) * 4, l = 0.2126 * d[o] + 0.7152 * d[o + 1] + 0.0722 * d[o + 2];
      all += l;
      if (x >= 10 && x < 22 && y >= 5 && y < 19) { mid += l; nm++; }
    }
    const avg = all / 768, center = mid / nm, edges = (all - mid) / (768 - nm);
    brightness = Math.round(avg);
    if (avg < 50) setChip('chip-light', 'bad', 'Poca luce');
    else if (edges - center > 45) setChip('chip-light', 'warn', 'Controluce');
    else if (avg > 225) setChip('chip-light', 'warn', 'Troppa luce');
    else setChip('chip-light', 'ok', 'Luce buona');
  }

  function drawHands(r) {
    const dpr = devicePixelRatio || 1, w = Math.round(frame.clientWidth * dpr), h = Math.round(frame.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.fillStyle = '#2997ff';
    for (const pts of r.landmarks) {
      ctx.beginPath();
      for (const [a, b] of CONNECTIONS) { ctx.moveTo(pts[a].x * w, pts[a].y * h); ctx.lineTo(pts[b].x * w, pts[b].y * h); }
      ctx.stroke();
      for (const p of pts) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 3.2 * dpr, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (live.readyState < 2 || phase === 'review' || phase === 'done') return;
    if (now - lastLight > 600) { lastLight = now; checkLight(); }
    if (!hands || live.currentTime === lastFrameTime) return;
    lastFrameTime = live.currentTime;
    let r;
    try { r = hands.detectForVideo(live, performance.now()); } catch { return; }
    drawHands(r);
    const n = r.landmarks.length;
    const edge = r.landmarks.some(pts => pts.some(p => p.x < 0.02 || p.x > 0.98 || p.y < 0.02 || p.y > 0.98));
    if (!n) setChip('chip-hands', 'warn', 'Mostra le mani');
    else if (edge) setChip('chip-hands', 'warn', 'Mani al bordo');
    else setChip('chip-hands', 'ok', n > 1 ? 'Due mani visibili' : 'Mano visibile');
    if (track) {
      track.total++; if (n) track.seen++; if (n > 1) track.two++;
      if (track.frames.length < 2000) {
        track.frames.push({
          t: Math.round(performance.now() - track.t0),
          hands: r.landmarks.map((pts, k) => ({
            h: r.handedness[k]?.[0]?.categoryName ?? null,
            s: +(r.handedness[k]?.[0]?.score ?? 0).toFixed(3),
            p: pts.flatMap(p => [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)]),
          })),
        });
      }
    }
  }

  // Registrazione
  function countdown() {
    setPhase('countdown');
    let n = 3;
    const tick = () => {
      if (phase !== 'countdown') return;
      if (n === 0) return startRecording();
      $('#countdown', el).innerHTML = `<span>${n}</span>`;
      vibrate(8);
      n--;
      later(tick, 900);
    };
    tick();
  }

  function startRecording() {
    chunks = [];
    try { recorder = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: 2_500_000 }); }
    catch { recorder = new MediaRecorder(stream); }
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = onStop;
    recorder.start(250);
    t0 = performance.now();
    track = { t0, frames: [], seen: 0, two: 0, total: 0 };
    const max = MAX_MS[prompts[i].type];
    setPhase('recording');
    vibrate(20);
    const bar = $('#timebar', el);
    bar.style.setProperty('--dur', `${max}ms`);
    void bar.offsetWidth;
    bar.classList.add('run');
    const tick = () => {
      if (phase !== 'recording') return;
      setChip('chip-rec', 'rec', `${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`);
      later(tick, 100);
    };
    tick();
    later(() => { if (phase === 'recording') stopRecording(); }, max);
  }

  function stopRecording() {
    if (recorder?.state !== 'recording') return;
    dur = performance.now() - t0;
    recorder.stop();
    vibrate(12);
  }

  function onStop() {
    if (phase !== 'recording') return; // registrazione annullata
    take = track; track = null;
    blob = new Blob(chunks, { type: recorder.mimeType || MIME });
    if (dur < 700) { toast('Troppo breve. Riprova con calma.'); return setPhase('idle'); }
    const handsRatio = take.total ? take.seen / take.total : null;
    warn = hands && take.total > 5 && handsRatio < 0.5 ? 'Le mani si vedono poco. Puoi rifarlo, se vuoi.'
      : brightness != null && brightness < 50 ? 'Il video è un po’ buio. Puoi rifarlo, se vuoi.' : '';
    blobUrl = URL.createObjectURL(blob);
    setPhase('review');
    playback.src = blobUrl;
    playback.play().catch(() => {});
  }

  function discardTake() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blob = blobUrl = take = null; warn = '';
  }

  function useTake() {
    const p = prompts[i];
    const w = live.videoWidth, h = live.videoHeight;
    enqueue({
      blob,
      meta: {
        prompt_id: p.id, text: p.id ? undefined : p.it, variant: !!$('#variant', panel)?.checked, note: $('#note', panel)?.value || '',
        duration_ms: Math.round(dur), width: w, height: h,
        quality: { brightness, hands_ratio: take?.total ? take.seen / take.total : null, two_hands_ratio: take?.total ? take.two / take.total : null },
      },
      landmarks: hands && take?.frames.length ? {
        format: 'segnalis-hands/1', library: `@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`, model: 'hand_landmarker float16/1',
        mirrored: false, handedness: 'etichetta MediaPipe grezza su fotogrammi non specchiati', width: w, height: h,
        point_format: '21 punti × [x, y, z], coordinate normalizzate', frames: take.frames,
      } : null,
    });
    recorded++;
    me.stats.today++;
    blob = null; // il blob ora appartiene alla coda di invio
    next();
  }

  function next() {
    discardTake();
    i++;
    if (i >= prompts.length) finish(); else setPhase('idle');
  }

  function finish() {
    phase = 'done';
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    const total = prompts.length;
    const mins = Math.max(1, Math.round((Date.now() - sessionStart) / 60000));
    const full = !isFree && recorded === total;
    const done = $('#done', el);
    done.hidden = false;
    done.innerHTML = `<div>
      ${ring(0, 150, 16, '#ff3b30')}
      <h2>${isFree ? (recorded ? 'Grazie.' : 'Alla prossima.') : full ? 'Anello chiuso.' : 'Sessione finita.'}</h2>
      <p>${recorded ? `${recorded} ${recorded === 1 ? 'segno registrato' : 'segni registrati'} in ${mins} min.` : 'Nessun video registrato questa volta.'}
        ${uploads.queue.length ? 'Stiamo finendo di inviarli.' : recorded ? 'Già al sicuro.' : ''}</p>
      <div class="stack">
        <button class="btn btn-primary btn-lg" data-act="again">${isFree ? 'Proponi un altro segno' : 'Altri dieci'}</button>
        ${me.canReview ? '<a class="btn btn-secondary btn-lg" href="#/valida">Valida i video degli altri</a>' : ''}
        <a class="link" href="#/registra">Scegli un'altra categoria</a>
      </div></div>`;
    requestAnimationFrame(() => requestAnimationFrame(() => setRing($('.ring', done), isFree ? (recorded ? 1 : 0) : recorded / total)));
    if (full) vibrate([20, 60, 20]);
    $('[data-act=again]', done).focus();
  }

  function close() {
    if (phase === 'recording') { phase = 'closing'; recorder.stop(); }
    go('#/registra');
  }

  // Comandi
  async function act(a) {
    const p = prompts[i];
    if (a === 'close') return close();
    if (a === 'retry') { if (await startCamera()) setPhase(isFree && !prompts.length ? 'compose' : 'idle'); return; }
    if (a === 'again') return route();
    if (a === 'shutter') {
      if (phase === 'idle') countdown();
      else if (phase === 'countdown') setPhase('idle');
      else if (phase === 'recording') stopRecording();
      return;
    }
    if (phase === 'idle' && a === 'skip') return next();
    if (phase === 'idle' && a === 'unknown' && p.id) { api('/api/skips', { method: 'POST', body: { prompt_id: p.id } }).catch(() => {}); return next(); }
    if (phase === 'review' && a === 'redo') { discardTake(); return setPhase('idle'); }
    if (phase === 'review' && a === 'use') return useTake();
  }
  el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b.dataset.act); });
  const onKey = e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || $('#dialog').open) return;
    const k = e.key;
    if (k === 'Escape') return close();
    if (k === ' ' && ['idle', 'countdown', 'recording'].includes(phase)) { e.preventDefault(); return act('shutter'); }
    if (phase === 'review' && k === 'Enter') { e.preventDefault(); return act('use'); }
    if (phase === 'review' && (k === 'Backspace' || k.toLowerCase() === 'r')) { e.preventDefault(); return act('redo'); }
    if (phase === 'idle' && k.toLowerCase() === 's') return act('skip');
  };
  document.addEventListener('keydown', onKey);

  // Avvio
  setPhase('loading');
  loadHands().then(h => { hands = h; if (!stopped) setChip('chip-hands', 'warn', 'Mostra le mani'); })
    .catch(e => { console.warn('MediaPipe non disponibile', e); setChip('chip-hands'); });
  setChip('chip-hands', 'idle', 'Avvio rilevamento mani…');
  const [camOk, session] = await Promise.all([startCamera(), isFree ? Promise.resolve({ prompts: [] }) : api(`/api/session?category=${encodeURIComponent(cat)}`)]);
  if (stopped) return;
  prompts = session.prompts;
  raf = requestAnimationFrame(loop);
  if (!isFree && !prompts.length) {
    showMsg('Hai registrato tutto.', 'Hai già segnato tutta questa categoria. Grazie davvero.', ['close', "Scegli un'altra categoria"]);
    panel.innerHTML = '';
  } else if (camOk) setPhase(isFree ? 'compose' : 'idle');
  else renderTop();

  return () => {
    stopped = true;
    if (recorder?.state === 'recording') { phase = 'closing'; recorder.stop(); }
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    stream?.getTracks().forEach(t => t.stop());
    document.removeEventListener('keydown', onKey);
    discardTake();
  };
}

// ——— Validazione ———
async function review(el) {
  if (!me.canReview) {
    el.innerHTML = `<div class="page center"><h1 class="headline">Valida.</h1>
      <p class="lead mt-2">La validazione è riservata a persone sorde, CODA, interpreti e a chi segna da almeno un anno. Così il dataset resta affidabile.</p>
      <p class="muted mt-3">Se il tuo profilo è cambiato, aggiornalo.</p><div class="row mt-3"><a class="btn btn-primary" href="#/profilo">Aggiorna il profilo</a><a class="btn btn-secondary" href="#/registra">Registra segni</a></div></div>`;
    return;
  }
  el.innerHTML = `<div class="page"><div class="review-wrap">
    <div class="page-head center"><h1 class="headline">Valida.</h1><p class="lead">Guarda il video e dicci se il segno corrisponde. Ogni video ha bisogno di due conferme.</p></div>
    <div id="rv" aria-live="polite"></div><p class="center tiny mt-3" id="count"></p></div></div>`;
  const rv = $('#rv', el);
  const skipped = [];
  let url = null, current = null, count = 0, busy = false;

  async function load() {
    current = null;
    rv.innerHTML = '<div class="spinner mt-4"></div>';
    const { recording } = await api(`/api/review/next?skip=${encodeURIComponent(skipped.slice(-50).join(','))}`);
    if (!recording) {
      rv.innerHTML = `<div class="card empty"><h2 class="title">Tutto validato.</h2><p class="mt-1">Non ci sono altri video da controllare, per ora. Torna più tardi.</p>
        <div class="row mt-3" style="justify-content:center"><a class="btn btn-primary" href="#/registra">Registra segni</a></div></div>`;
      return;
    }
    const blob = await api(`/api/recordings/${recording.id}/video`);
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    current = recording;
    rv.innerHTML = `<div class="review-video"><video src="${url}" autoplay loop muted playsinline aria-label="Video da validare"></video>
        <div class="chips">${recording.variant ? `<span class="chip warn"><i></i>Variante${recording.region ? ` · ${esc(recording.region)}` : ''}</span>` : ''}</div></div>
      <div class="center mt-3"><p class="muted small">${TYPE_LABEL[recording.type]} · dovrebbe significare</p><p class="title">${esc(recording.text_it)}</p>
        ${recording.note ? `<p class="muted small mt-1">Nota: «${esc(recording.note)}»</p>` : ''}</div>
      <div class="verdicts">
        <button class="verdict ok" data-v="ok">Corretto<kbd>1</kbd></button>
        <button class="verdict wrong" data-v="wrong">Non corrisponde<kbd>2</kbd></button>
        <button class="verdict unusable" data-v="unusable">Video inutilizzabile<kbd>3</kbd></button>
      </div>
      <div class="center mt-2"><button class="link link-plain" data-v="skip">Non sono sicuro, salta <kbd class="tiny">S</kbd></button></div>`;
  }

  async function vote(v) {
    if (!current || busy) return;
    busy = true;
    try {
      if (v === 'skip') skipped.push(current.id);
      else {
        await api('/api/reviews', { method: 'POST', body: { recording_id: current.id, verdict: v } });
        count++;
        $('#count', el).textContent = `${count} ${count === 1 ? 'video validato' : 'video validati'} in questa sessione. Grazie.`;
      }
      await load();
    } catch (e) { toast(e.message); } finally { busy = false; }
  }
  rv.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) vote(b.dataset.v); });
  const onKey = e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey) return;
    const map = { 1: 'ok', 2: 'wrong', 3: 'unusable', s: 'skip' };
    if (map[e.key.toLowerCase()]) vote(map[e.key.toLowerCase()]);
  };
  document.addEventListener('keydown', onKey);
  await load();
  return () => { document.removeEventListener('keydown', onKey); if (url) URL.revokeObjectURL(url); };
}

// ——— Profilo ———
async function profile(el) {
  const [fresh, recs] = await Promise.all([api('/api/me'), api('/api/me/recordings')]);
  me = fresh;
  const s = me.stats;
  const recRow = r => `<div class="list-row" data-id="${r.id}"><div class="grow"><div class="rec-title">${esc(r.text_it)}</div>
    <p>${TYPE_LABEL[r.type]} · ${new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}${r.variant ? ' · variante' : ''}</p></div>
    <span class="pill ${r.status}">${STATUS_LABEL[r.status]}</span>
    <button class="btn btn-secondary btn-sm" data-act="play">Guarda</button>
    <button class="ibtn" data-act="del" aria-label="Elimina «${esc(r.text_it)}»">${ICONS.trash}</button></div>`;

  el.innerHTML = `<div class="page">
    <div class="page-head split-head"><div><h1 class="headline">Il tuo contributo.</h1><p class="lead">Ogni video aiuta una macchina a capire la LIS un po' meglio.</p></div>${todayBlock()}</div>
    <div class="stat-grid">
      ${[[s.recordings, 'Video registrati'], [s.validated, 'Validati'], [s.pending, 'In verifica'], [s.reviews, 'Revisioni fatte']].map(([n, l]) => `<div class="card stat"><b>${fmt(n)}</b><span>${l}</span></div>`).join('')}
    </div>

    <h2 class="group-title">I tuoi video</h2>
    <div class="list" id="recs">${recs.length ? recs.map(recRow).join('') : '<div class="empty">Ancora nessun video. <a href="#/registra">Registra il primo</a>.</div>'}</div>

    <h2 class="group-title">Chi sei</h2>
    <form class="card card-pad" id="pf">${profileFields(me.profile)}<div class="row mt-4"><button class="btn btn-primary">Salva</button></div></form>

    <h2 class="group-title">Consensi</h2>
    <div class="list" id="consents">${consentRows(me.consent, true)}</div>
    <p class="hint">Per revocare il consenso alla ricerca, elimina i tuoi dati qui sotto.</p>

    <h2 class="group-title">La tua chiave</h2>
    <div class="card card-pad"><div class="key-box"><code id="key">••••••••••••••••</code>
      <button class="btn btn-secondary btn-sm" data-act="show">Mostra</button><button class="btn btn-secondary btn-sm" data-act="copy">Copia</button></div>
      <p class="hint">Usala per accedere da un altro dispositivo. Non condividerla: chi la possiede può cancellare i tuoi video.</p></div>

    <h2 class="group-title">I tuoi dati</h2>
    <div class="list">
      <div class="list-row"><div class="grow"><h4>Scarica i tuoi dati</h4><p>Profilo, consensi e informazioni sui video, in formato JSON.</p></div><button class="btn btn-secondary btn-sm" data-act="export">Scarica</button></div>
      <div class="list-row"><div class="grow"><h4>Esci da questo dispositivo</h4><p>I tuoi video restano. Potrai rientrare con la chiave.</p></div><button class="btn btn-secondary btn-sm" data-act="logout">Esci</button></div>
      <div class="list-row"><div class="grow"><h4>Elimina tutti i miei dati</h4><p>Video, punti delle mani, revisioni e profilo. Per sempre.</p></div><button class="btn btn-danger btn-sm" data-act="delete">Elimina</button></div>
    </div></div>`;

  $('#pf', el).onsubmit = async e => {
    e.preventDefault();
    try { me = await api('/api/me', { method: 'PATCH', body: { profile: readProfile(e.target) } }); toast('Profilo aggiornato.'); }
    catch (err) { toast(err.message); }
  };
  $('#consents', el).onchange = async e => {
    const i = e.target.closest('[data-consent]');
    if (!i) return;
    try { me = await api('/api/me', { method: 'PATCH', body: { consent: { ...me.consent, [i.dataset.consent]: i.checked } } }); toast('Consenso aggiornato.'); }
    catch (err) { i.checked = !i.checked; toast(err.message); }
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('[data-id]');
    const a = b.dataset.act;
    if (a === 'play') {
      try { videoDialog(URL.createObjectURL(await api(`/api/recordings/${row.dataset.id}/video`)), $('.rec-title', row).textContent); }
      catch (err) { toast(err.message); }
    } else if (a === 'del') {
      if (!(await confirmDialog({ title: 'Eliminare questo video?', text: 'Il video e i punti delle mani verranno cancellati per sempre.', ok: 'Elimina', danger: true }))) return;
      try { await api(`/api/recordings/${row.dataset.id}`, { method: 'DELETE' }); row.remove(); toast('Video eliminato.'); }
      catch (err) { toast(err.message); }
    } else if (a === 'show') {
      $('#key', el).textContent = store.get(KEY);
    } else if (a === 'copy') {
      navigator.clipboard?.writeText(store.get(KEY)).then(() => toast('Chiave copiata.'), () => toast('Copia non riuscita.'));
    } else if (a === 'export') {
      try { download('segnalis-miei-dati.json', await api('/api/me/export')); } catch (err) { toast(err.message); }
    } else if (a === 'logout') {
      if (!(await confirmDialog({ title: 'Uscire da questo dispositivo?', text: 'Per rientrare ti servirà la tua chiave. Copiala prima di uscire, se non l’hai già fatto.', ok: 'Esci' }))) return;
      store.set(KEY, null); me = null; go('#/');
    } else if (a === 'delete') {
      if (uploads.queue.length) return toast('Attendi la fine degli invii in corso, poi riprova.');
      if (!(await confirmDialog({ title: 'Eliminare tutti i tuoi dati?', text: 'Video, punti delle mani, revisioni e profilo verranno cancellati per sempre. Non si può annullare.', ok: 'Elimina tutto', danger: true }))) return;
      try { await api('/api/me', { method: 'DELETE' }); store.set(KEY, null); me = null; go('#/'); toast('Tutti i tuoi dati sono stati eliminati.'); }
      catch (err) { toast(err.message); }
    }
  });
}

// ——— Dataset ———
async function dataset(el) {
  const s = await api('/api/stats');
  const prog = Object.fromEntries(s.categories.map(c => [c.id, c]));
  const dist = rows => {
    const max = Math.max(1, ...rows.map(r => r.n ?? 0));
    return rows.map(r => `<div class="dist-row"><span>${esc(r.name)}</span><div class="bar" style="--p:${(r.n ?? 2) / max}"><i></i></div><b>${r.n == null ? '<5' : fmt(r.n)}</b></div>`).join('');
  };
  el.innerHTML = `
  <section class="section center">
    <p class="eyebrow">Dataset</p>
    <h1 class="display">Costruito da chi segna.</h1>
    <p class="lead mt-3">Video in LIS verificati dalla comunità, con i punti delle mani fotogramma per fotogramma. Pensato per la ricerca, nel rispetto di ogni persona che lo ha reso possibile.</p>
    <div class="ribbon">${metrics(s)}</div>
  </section>
  <section class="band"><div class="section">
    <h2 class="title">Copertura del vocabolario</h2>
    <p class="muted mt-1">Obiettivo: ${s.target} persone diverse per ogni segno, da regioni diverse.</p>
    <div class="card card-pad mt-3 dist">${catalog.categories.map(c => `<div class="dist-row" style="--c:${c.color}"><span>${esc(c.name)}</span><div class="bar" style="--p:${prog[c.id].progress}"><i></i></div><b>${pct(prog[c.id].progress)}</b></div>`).join('')}</div>
    <div class="grid-2 mt-5">
      <div><h2 class="title">Regioni</h2><p class="muted mt-1">Dove ha imparato a segnare chi contribuisce.</p><div class="card card-pad mt-3 dist">${dist(s.regions)}</div></div>
      <div><h2 class="title">Chi contribuisce</h2><p class="muted mt-1">Rapporto con la LIS e fascia d'età.</p><div class="card card-pad mt-3 dist">${dist(s.relations)}</div><div class="card card-pad mt-2 dist">${dist(s.ages)}</div></div>
    </div>
    <p class="tiny mt-3">Per proteggere la privacy, i gruppi con meno di 5 persone sono mostrati come «&lt;5».</p>
  </div></section>
  <section class="section">
    <h2 class="title">Scheda tecnica</h2>
    <div class="card mt-3"><table class="specs"><tbody>
      <tr><th>Lingua</th><td>Lingua dei Segni Italiana (LIS) · codice ISO 639-3 «ise»</td></tr>
      <tr><th>Contenuti</th><td>${fmt(s.prompts)} voci in ${catalog.categories.length} categorie: dattilologia, numeri, segni e frasi. Più i segni proposti liberamente da chi contribuisce.</td></tr>
      <tr><th>Video</th><td>WebM (VP8/VP9) o MP4, fino a 1280×720, 30 fps, senza audio. Da 1 a 15 secondi, con le mani a riposo all'inizio e alla fine.</td></tr>
      <tr><th>Punti delle mani</th><td>MediaPipe Hands (HandLandmarker): 21 punti x, y, z per mano, fino a due mani, per ogni fotogramma. Calcolati sul dispositivo di chi registra.</td></tr>
      <tr><th>Annotazioni</th><td>Testo italiano, glossa, categoria, tipo, varianti regionali segnalate con note.</td></tr>
      <tr><th>Qualità</th><td>Luminosità, presenza delle mani per fotogramma, voti di validazione: un video è valido con almeno due conferme.</td></tr>
      <tr><th>Chi segna</th><td>Pseudonimo, rapporto con la LIS, esperienza, dove ha imparato, regione, fascia d'età, genere, mano dominante. Tutto facoltativo.</td></tr>
      <tr><th>Licenze</th><td>Per ogni video: ricerca sempre; condivisione con enti esterni e uso commerciale solo se chi ha registrato li ha consentiti.</td></tr>
      <tr><th>Export</th><td>manifest.jsonl con una riga per video, più la cartella dei video e dei punti delle mani.</td></tr>
    </tbody></table></div>
    <div class="card card-pad mt-4"><h3 class="title">Fai ricerca?</h3>
      <p class="muted mt-1">L'accesso è riservato a università ed enti di ricerca, con un accordo che rispetta i consensi di ogni persona.</p>
      <a class="btn btn-primary mt-3" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Richiesta di accesso al dataset Segnalis')}">Richiedi l'accesso</a></div>
  </section>`;
}

// ——— Privacy ———
async function privacy(el) {
  el.innerHTML = `<div class="page section-narrow prose">
    <p class="eyebrow">Informativa</p><h1 class="headline">La tua privacy, in parole semplici.</h1>
    <p class="notice mt-3">Bozza: il testo va completato con i dati del titolare e verificato da un consulente privacy (DPO) prima del lancio pubblico.</p>
    <h2>Chi tratta i tuoi dati</h2>
    <p>Il titolare del trattamento è <strong>[nome dell'ente o dell'associazione, indirizzo, contatto email]</strong>. Il responsabile della protezione dei dati è raggiungibile a <strong>[email DPO]</strong>.</p>
    <h2>Quali dati raccogliamo</h2>
    <ul>
      <li><strong>Video</strong> dei segni che registri. Mostrano volto, mani e busto. Non registriamo mai l'audio.</li>
      <li><strong>Punti delle mani</strong> (21 per mano) calcolati sul tuo dispositivo da MediaPipe. Il modello gira nel tuo browser: le immagini non vengono analizzate da servizi esterni.</li>
      <li><strong>Profilo facoltativo</strong>: rapporto con la LIS, esperienza, regione, fascia d'età, genere, mano dominante.</li>
      <li><strong>Dati tecnici</strong>: durata, risoluzione e qualità dei video, revisioni che fai.</li>
    </ul>
    <p>Non chiediamo nome, email, telefono o password. Ti identifichi solo con una chiave anonima, che conserviamo in forma cifrata.</p>
    <h2>Perché e su quale base</h2>
    <p>Per costruire un dataset che permetta di creare modelli capaci di riconoscere e tradurre la LIS. Il volto in un video è un dato biometrico: lo trattiamo solo con il tuo <strong>consenso esplicito</strong> (art. 9, par. 2, lett. a del GDPR), che puoi revocare in ogni momento.</p>
    <h2>Chi può vedere i tuoi video</h2>
    <ul>
      <li>Il team del progetto, per gestire il dataset.</li>
      <li>Altri volontari esperti, solo se hai attivato «Validazione dalla comunità».</li>
      <li>Università ed enti di ricerca, solo se hai attivato «Condivisione con la ricerca», con accordi che vietano altri usi.</li>
      <li>Aziende che sviluppano prodotti accessibili, solo se hai attivato «Prodotti accessibili».</li>
    </ul>
    <h2>Per quanto tempo</h2>
    <p>Finché non revochi il consenso o fino alla chiusura del progetto. Se elimini i tuoi dati, li cancelliamo subito dai nostri sistemi e li escludiamo dalle versioni successive del dataset.</p>
    <h2>I tuoi diritti</h2>
    <p>Puoi accedere ai tuoi dati, scaricarli, correggerli, cancellarli e revocare i consensi direttamente dal tuo profilo. Puoi anche presentare reclamo al Garante per la protezione dei dati personali.</p>
    <h2>Minori</h2>
    <p>Per ora la partecipazione è riservata a persone maggiorenni.</p>
  </div>`;
}

// ——— Avvio ———
$('.nav-menu').onclick = () => {
  const open = $('#nav').classList.toggle('open');
  $('.nav-menu').setAttribute('aria-expanded', open);
};
(async function boot() {
  try { catalog = await api('/api/catalog'); }
  catch { app.innerHTML = '<div class="page center"><h1 class="title">Segnalis non è raggiungibile.</h1><p class="lead mt-2">Controlla la connessione e ricarica la pagina.</p></div>'; return; }
  if (store.get(KEY)) me = await api('/api/me').catch(() => null);
  addEventListener('hashchange', route);
  route();
})();
