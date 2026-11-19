// GTA VI trophy guide + tracker: loads data/trophies.json, renders filters, search,
// sort, spoiler hiding, a 4-phase platinum roadmap, and a checklist saved in
// localStorage under 'gta6-trophy-checklist'. Fully offline: the only request is
// the relative fetch of data/trophies.json. Query params: ?view=roadmap,
// ?trophy=<id>, ?filter=missable, ?demo=1 (marks ~14 sample trophies earned).
const KEY = 'gta6-trophy-checklist';
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const listEl = $('trophy-list');
const detailEl = $('detail');
const searchEl = $('search');
const gradeEl = $('grade');
const kindEl = $('kind');
const missableEl = $('missable-only');
const earnedEl = $('earned-filter');
const sortEl = $('sort');
const spoilerEl = $('spoiler');

let trophies = [];
let earned = new Set();
let openId = null;

try { earned = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { earned = new Set(); }
function save() { localStorage.setItem(KEY, JSON.stringify([...earned])); }

function gradeLabel(g) { return g ? g[0].toUpperCase() + g.slice(1) : ''; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function isHiddenStory(t) {
  // The data file marks hidden trophies explicitly; fall back to kind + a
  // "hidden" marker in the description so a partial data file still spoils safely.
  if (t.hidden === true) return true;
  if (t.hidden === false) return false;
  return t.kind === 'story' && /hidden/i.test(String(t.description || ''));
}
function isSpoiled(t) { return spoilerEl.checked && isHiddenStory(t) && !earned.has(String(t.id)); }
function timeMinutes(t) {
  const m = String(t.time || '').match(/(\d+(?:\.\d+)?)\s*(h|hr|hour|min)/i);
  if (!m) return 9999;
  const v = parseFloat(m[1]);
  return /h/i.test(m[2]) ? v * 60 : v;
}
function diffStars(t) { const d = Number(t.difficulty) || 1; return '★'.repeat(d) + '☆'.repeat(Math.max(0, 5 - d)); }

function card(t) {
  const li = document.createElement('li');
  li.className = 'trophy-card grade-' + (t.grade || 'bronze');
  li.dataset.id = String(t.id);
  const done = earned.has(String(t.id));
  const spoiled = isSpoiled(t);
  const name = spoiled ? 'Hidden trophy — earn it to reveal' : t.name;
  const desc = spoiled ? 'This story trophy is hidden until you earn it. Turn off “Hide story spoilers” to see it now.' : (t.description || '');
  li.innerHTML =
    '<label class="earned-box"><input type="checkbox"' + (done ? ' checked' : '') + ' aria-label="Mark ' + esc(name) + ' as earned"><span>Earned</span></label>' +
    '<div class="card-main">' +
    '<div class="card-head"><h3>' + esc(name) + '</h3><span class="badge badge-' + esc(t.grade || 'bronze') + '">' + esc(gradeLabel(t.grade)) + '</span></div>' +
    '<p class="desc">' + esc(desc) + '</p>' +
    '<p class="meta"><span class="diff" title="Difficulty">' + esc(diffStars(t)) + '</span>' +
    (t.time ? '<span>⏱ ' + esc(timeLabel(t)) + '</span>' : '') +
    (t.kind ? '<span class="kind-tag">' + esc(t.kind) + '</span>' : '') +
    (t.count ? '<span>×' + esc(t.count) + '</span>' : '') +
    '</p>' +
    (t.missable ? '<p class="missable-banner">⚠ Missable — can only be earned at this point in the story. Do it before moving on.</p>' : '') +
    '<button type="button" class="guide-toggle" aria-expanded="' + (openId === String(t.id)) + '">' + (openId === String(t.id) ? 'Hide guide' : 'Show guide') + '</button>' +
    (openId === String(t.id) ? guideHtml(t, spoiled) : '') +
    '</div>';
  li.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
    if (e.target.checked) earned.add(String(t.id)); else earned.delete(String(t.id));
    save(); render();
  });
  li.querySelector('.guide-toggle').addEventListener('click', () => {
    openId = openId === String(t.id) ? null : String(t.id);
    showDetail(openId ? trophies.find((x) => String(x.id) === openId) : null);
    render();
  });
  return li;
}

function guideHtml(t, spoiled) {
  if (spoiled) return '<div class="guide"><p>Guide hidden with the spoiler setting — earn the trophy or turn spoilers off to read it.</p></div>';
  const sources = Array.isArray(t.sources) && t.sources.length
    ? '<p class="sources">Sources: ' + t.sources.map((s) => esc(s)).join(' · ') + '</p>'
    : '<p class="sources">Source: official trophy description as published by PlayStation.</p>';
  return '<div class="guide"><p>' + esc(t.guide || 'Follow the official description.') + '</p>' + sources + '</div>';
}

function showDetail(t) {
  if (!t) { detailEl.hidden = true; detailEl.replaceChildren(); return; }
  const spoiled = isSpoiled(t);
  detailEl.hidden = false;
  detailEl.innerHTML =
    '<div class="detail-head"><h2>' + esc(spoiled ? 'Hidden trophy — earn it to reveal' : t.name) + '</h2>' +
    '<span class="badge badge-' + esc(t.grade || 'bronze') + '">' + esc(gradeLabel(t.grade)) + '</span>' +
    '<button type="button" id="detail-close">Close</button></div>' +
    '<p class="desc">' + esc(spoiled ? 'Hidden until earned.' : (t.description || '')) + '</p>' +
    '<p class="meta"><span>' + esc(diffStars(t)) + ' difficulty ' + (Number(t.difficulty) || 1) + '/5</span>' +
    (t.time ? '<span>⏱ ' + esc(timeLabel(t)) + '</span>' : '') +
    (t.kind ? '<span class="kind-tag">' + esc(t.kind) + '</span>' : '') +
    (t.missable ? '<span class="missable-tag">Missable</span>' : '') + '</p>' +
    guideHtml(t, spoiled);
  detailEl.querySelector('#detail-close').addEventListener('click', () => { openId = null; showDetail(null); render(); });
  // Deliberately no scrollIntoView: the detail sits right under the filters,
  // so it is visible in the first viewport without pushing the header away.
}

function filtered() {
  const q = searchEl.value.trim().toLowerCase();
  let out = trophies.filter((t) => {
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (kindEl.value !== 'all') {
      if (kindEl.value === 'missable') { if (!t.missable) return false; }
      else if (t.kind !== kindEl.value) return false;
    }
    if (missableEl.checked && !t.missable) return false;
    if (earnedEl.value === 'earned' && !earned.has(String(t.id))) return false;
    if (earnedEl.value === 'not-earned' && earned.has(String(t.id))) return false;
    if (q && !(String(t.name).toLowerCase().includes(q) || String(t.description || '').toLowerCase().includes(q) || String(t.guide || '').toLowerCase().includes(q))) return false;
    return true;
  });
  if (sortEl.value === 'difficulty') out = [...out].sort((a, b) => (Number(a.difficulty) || 1) - (Number(b.difficulty) || 1));
  else if (sortEl.value === 'time') out = [...out].sort((a, b) => timeMinutes(a) - timeMinutes(b));
  return out;
}

function renderProgress() {
  const total = trophies.length || 55;
  const n = [...earned].filter((id) => trophies.some((t) => String(t.id) === id)).length;
  const pct = total ? Math.round((n / total) * 100) : 0;
  $('progress-count').textContent = n + '/' + total + ' earned';
  $('progress-pct').textContent = pct + '% to platinum';
  $('progress-fill').style.width = pct + '%';
  $('progress-bar').setAttribute('aria-valuenow', String(n));
  $('progress-bar').setAttribute('aria-valuemax', String(total));
  const counts = {};
  for (const t of trophies) counts[t.grade] = (counts[t.grade] || 0) + 1;
  $('progress-sub').textContent = (counts.platinum || 0) + ' platinum · ' + (counts.gold || 0) + ' gold · ' + (counts.silver || 0) + ' silver · ' + (counts.bronze || 0) + ' bronze · ' + n + ' of ' + total + ' earned so far';
}

function render() {
  renderProgress();
  const rows = filtered();
  listEl.replaceChildren(...rows.map(card));
  $('empty').hidden = rows.length !== 0;
  $('result-count').textContent = rows.length + ' of ' + trophies.length + ' trophies shown' + (earned.size ? ' · ' + earned.size + ' earned' : '');
}

function phaseOf(t) {
  if (t.kind === 'story') return 0;
  if (t.missable || t.kind === 'missable') return 1;
  if (t.kind === 'collectible' || t.kind === 'activity' || t.kind === 'exploration') return 2;
  return 3;
}
function timeLabel(t) {
  // The data uses time "story" for trophies earned during the story itself.
  if (String(t.time).toLowerCase() === 'story') return 'During story';
  return t.time;
}

function renderRoadmap() {
  const phases = [
    { title: 'Phase 1 — Story playthrough', time: '30–40 hours', blurb: 'Play the story from Gone Fishing to the final mission. Every chapter and mission trophy lands here — just finish the story and enjoy Leonida.' },
    { title: 'Phase 2 — Missables & one-time chances', time: '3–5 hours', blurb: 'The trophies you can only earn once. Do each the first time it appears, save before story missions with a one-time chance, and check the missable banner on every card.' },
    { title: 'Phase 3 — Activities & collectibles', time: '15–25 hours', blurb: 'The open world after the credits: side activities, exploration and every collectible set, at your own pace.' },
    { title: 'Phase 4 — Grind & cleanup', time: '10–20 hours', blurb: 'The last repeatable goals — combat, money and social trophies — then the platinum pops.' },
  ];
  const ol = $('phases');
  ol.replaceChildren();
  phases.forEach((p, i) => {
    const members = trophies.filter((t) => phaseOf(t) === i);
    const li = document.createElement('li');
    li.className = 'phase';
    li.innerHTML = '<h3>' + esc(p.title) + '</h3><p class="phase-time">' + esc(p.time) + ' · ' + members.length + ' trophies</p><p>' + esc(p.blurb) + '</p>';
    const ul = document.createElement('ul');
    ul.className = 'phase-trophies';
    for (const t of members) {
      const item = document.createElement('li');
      const done = earned.has(String(t.id));
      item.innerHTML = '<span class="mini-badge badge-' + esc(t.grade || 'bronze') + '">' + esc(gradeLabel(t.grade)) + '</span> ' +
        '<button type="button" class="phase-link" data-id="' + esc(t.id) + '">' + esc(isSpoiled(t) ? 'Hidden trophy' : t.name) + '</button>' +
        (done ? ' ✓' : '') + (t.missable ? ' <span class="missable-tag">Missable</span>' : '');
      item.querySelector('.phase-link').addEventListener('click', (e) => {
        openId = e.currentTarget.dataset.id;
        showRoadmap(false);
        showDetail(trophies.find((x) => String(x.id) === openId));
        render();
      });
      ul.append(item);
    }
    li.append(ul);
    ol.append(li);
  });
  // Phase ranges (30–40 + 3–5 + 15–25 + 10–20 h) — summing every trophy's
  // own time would double-count, since most trophies are earned in parallel.
  $('roadmap-time').textContent = 'Estimated total: 58–90 hours';
  const avg = trophies.length ? (trophies.reduce((s, t) => s + (Number(t.difficulty) || 3), 0) / trophies.length) : 3;
  $('roadmap-diff').textContent = 'Overall difficulty: ' + Math.round(avg) + '/5';
}

function showRoadmap(show) {
  $('roadmap-section').hidden = !show;
  $('guide-section').hidden = show;
  $('view-roadmap').classList.toggle('active', show);
  $('view-guide').classList.toggle('active', !show);
}

$('view-roadmap').addEventListener('click', () => showRoadmap(true));
$('view-guide').addEventListener('click', () => showRoadmap(false));
for (const el of [searchEl, gradeEl, kindEl, missableEl, earnedEl, sortEl, spoilerEl]) {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
}
spoilerEl.addEventListener('change', () => { renderRoadmap(); render(); });

$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'GTA VI', earned: [...earned] }, null, 2)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const ids = Array.isArray(data) ? data : data.earned;
    earned = new Set((ids || []).map(String).filter((id) => trophies.some((t) => String(t.id) === id)));
    save(); render();
  } catch { alert('That file is not a valid progress export.'); }
  e.target.value = '';
});
$('reset').addEventListener('click', () => {
  if (!confirm('Clear all earned trophies?')) return;
  earned = new Set(); save(); render();
});

const doc = await (await fetch('data/trophies.json')).json();
trophies = doc.trophies || doc || [];
if (params.get('demo') === '1') {
  // Sample progress: the first ~14 trophies (story openers + a few early ones),
  // so the progress bar and earned state are visible in screenshots.
  for (const t of trophies.slice(0, 14)) earned.add(String(t.id));
  save();
}
if (params.get('spoilers') === 'off') spoilerEl.checked = false;
if (params.get('filter') === 'missable') { missableEl.checked = true; kindEl.value = 'missable'; }
if (params.get('grade')) gradeEl.value = params.get('grade');
if (params.get('kind')) kindEl.value = params.get('kind');
renderRoadmap();
render();
if (params.get('view') === 'roadmap') showRoadmap(true);
const focusId = params.get('trophy');
if (focusId) {
  const t = trophies.find((x) => String(x.id) === String(focusId));
  if (t) { openId = String(t.id); showDetail(t); render(); }
}
