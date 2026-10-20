// 습관 기록 — 사진으로 끼니 기록 + 주 1회 «3가지 세기» + 체중·혈압·둘레
import { store } from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view'), sheet = $('#sheet'), fileIn = $('#file');
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const monday = (s) => { const d = parse(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); };
const md = (s) => { const d = parse(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dow = (s) => DOW[parse(s).getDay()];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f1 = (n) => (n == null ? '–' : n.toFixed(1));
const f0 = (n) => (n == null ? '–' : Math.round(n));

const SLOTS = ['아침', '점심', '저녁', '간식', '술자리'];
const TITLES = { today: '오늘', week: '주간 돌아보기', body: '몸 기록', settings: '설정' };
let tab = 'today', day = today(), weekStart = monday(today());

function toast(t) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = t;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
}
function defaultSlot() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return '아침';
  if (h < 14.5) return '점심';
  if (h < 17.5) return '간식';
  return '저녁';
}
const mealsOn = (d) => store.list('meals').filter((m) => m.date === d).sort((a, b) => a.ts - b.ts);
const weightOn = (d) => store.list('weights').find((w) => w.date === d);

// ---------- 공통 조각 ----------
function mealGrid(list) {
  if (!list.length) return '<p class="hint">아직 기록이 없어요.</p>';
  return `<div class="meals">${list.map((m) => `
    <button class="meal" type="button" data-meal="${m.id}">
      ${m.photo ? `<img alt="" data-photo="${m.photo}">` : `<span class="noimg">${esc(m.memo || '사진 없음')}</span>`}
      <span class="tag"><span>${m.slot}</span>${m.pv ? '<span>단백질+채소</span>' : ''}${m.delivery ? '<span>배달</span>' : ''}</span>
    </button>`).join('')}</div>`;
}
function hydratePhotos() {
  view.querySelectorAll('img[data-photo]').forEach((img) => {
    store.photoURL(img.dataset.photo).then((u) => { if (u) img.src = u; });
  });
}
function weekCounts(start) {
  const end = addDays(start, 6);
  const ms = store.list('meals').filter((m) => m.date >= start && m.date <= end);
  const ws = store.list('weights').filter((w) => w.date >= start && w.date <= end).map((w) => w.kg);
  return {
    meals: ms.filter((m) => m.slot !== '간식').length,
    pv: ms.filter((m) => m.pv).length,
    snack: ms.filter((m) => m.slot === '간식').length,
    drink: new Set(ms.filter((m) => m.slot === '술자리').map((m) => m.date)).size,
    delivery: ms.filter((m) => m.delivery).length,
    days: new Set(ms.map((m) => m.date)).size,
    wAvg: avg(ws),
  };
}
function statsHTML(c, prev) {
  const S = store.S;
  const dw = c.wAvg != null && prev.wAvg != null ? c.wAvg - prev.wAvg : null;
  return `<div class="stats">
    <div class="stat good"><div class="k">① 단백질+채소 끼니</div><div class="v">${c.pv}</div><div class="s">끼니 ${c.meals}번 중 · 늘리기</div></div>
    <div class="stat"><div class="k">② 간식</div><div class="v">${c.snack}</div><div class="s">지난주 ${prev.snack} · 줄이기</div></div>
    <div class="stat ${c.drink > S.drinkMax ? 'warn' : ''}"><div class="k">③ 술자리</div><div class="v">${c.drink}<small style="font-size:14px;font-weight:400"> / ${S.drinkMax}</small></div><div class="s">주 ${S.drinkMax}회 이하</div></div>
    <div class="stat"><div class="k">③ 배달</div><div class="v">${c.delivery}</div><div class="s">지난주 ${prev.delivery}</div></div>
  </div>
  <p class="hint" style="margin-top:10px">체중 주간 평균 <b>${f1(c.wAvg)}kg</b>${dw != null ? ` · 지난주보다 ${dw > 0 ? '+' : ''}${dw.toFixed(1)}kg` : ''} · 기록한 날 ${c.days}/7일</p>`;
}

// ---------- 오늘 ----------
function renderToday() {
  const w = weightOn(day);
  const c = weekCounts(monday(day));
  view.innerHTML = `
    <div class="card">
      <div class="row" style="margin-bottom:12px">
        <input type="date" id="day" value="${day}" class="grow" max="${today()}">
        ${day !== today() ? '<button class="btn ghost" id="goToday" type="button">오늘로</button>' : ''}
      </div>
      <button class="btn primary big" id="addPhoto" type="button">📷 먹기 전에 사진 찍기</button>
      <div style="text-align:center;margin-top:6px"><button class="btn ghost" id="addNoPhoto" type="button">사진 없이 기록</button></div>
    </div>
    <div class="card"><h2>${md(day)} (${dow(day)}) 먹은 것 <small>눌러서 고치기</small></h2>${mealGrid(mealsOn(day))}</div>
    <div class="card">
      <h2>아침 체중 <small>일어나서 화장실 다녀온 뒤 · 공복</small></h2>
      <div class="row"><input type="number" inputmode="decimal" step="0.1" id="kg" placeholder="kg" value="${w ? w.kg : ''}" class="grow"><button class="btn primary" id="saveKg" type="button">${w ? '고치기' : '저장'}</button></div>
    </div>
    <div class="card"><h2>이번 주 지금까지 <small>${md(monday(day))}부터</small></h2>${statsHTML(c, weekCounts(addDays(monday(day), -7)))}</div>`;
  $('#day').onchange = (e) => { day = e.target.value || today(); render(); };
  const gt = $('#goToday'); if (gt) gt.onclick = () => { day = today(); render(); };
  $('#addPhoto').onclick = () => { fileIn.value = ''; fileIn.click(); };
  $('#addNoPhoto').onclick = () => openMeal({ date: day });
  $('#saveKg').onclick = () => {
    const kg = num($('#kg').value);
    if (kg == null || kg < 30 || kg > 200) { toast('체중을 확인해 주세요'); return; }
    store.upsert('weights', { id: 'w' + day, date: day, kg });
    toast('체중을 저장했어요');
  };
}

fileIn.onchange = async () => {
  const f = fileIn.files && fileIn.files[0];
  if (!f) return;
  try { openMeal({ date: day }, await shrink(f)); } catch { toast('사진을 열 수 없어요'); }
};
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', 0.8));
  } finally { URL.revokeObjectURL(url); }
}

// ---------- 끼니 기록 시트 ----------
function openMeal(init, blob = null) {
  const m = init.id ? { ...init } : { date: init.date, ts: Date.now(), slot: defaultSlot(), pv: false, delivery: false, memo: '', photo: null };
  if (!init.id && init.date !== today()) m.ts = parse(init.date).getTime() + 12 * 3600e3;
  const draw = () => {
    sheet.innerHTML = `<div class="panel">
      <h2>${init.id ? '기록 고치기' : '끼니 기록'} · ${md(m.date)} (${dow(m.date)})</h2>
      ${blob || m.photo ? '<img class="preview" id="pv" alt="">' : ''}
      <div class="sec"><label class="f">언제 먹었나요</label>
        <div class="chips">${SLOTS.map((s) => `<button type="button" class="chip ${m.slot === s ? 'on' : ''}" data-slot="${s}">${s}</button>`).join('')}</div></div>
      <div class="sec" style="display:grid;gap:8px">
        <button type="button" class="toggle ${m.pv ? 'on' : ''}" data-t="pv"><span><b>단백질 + 채소</b>가 같이 있어요<br><span class="hint">고기·생선·달걀·두부 + 채소</span></span><span class="dot">${m.pv ? '✓' : ''}</span></button>
        <button type="button" class="toggle ${m.delivery ? 'on' : ''}" data-t="delivery"><span><b>배달</b>이에요</span><span class="dot">${m.delivery ? '✓' : ''}</span></button>
      </div>
      <div class="sec"><label class="f">메모 (선택 · 먹기 전 기분, 같이 먹은 사람 등)</label><textarea id="memo" rows="2">${esc(m.memo)}</textarea></div>
      <div class="acts">
        <button type="button" class="btn" id="cancel">닫기</button>
        <button type="button" class="btn primary" id="save">저장</button>
      </div>
      ${init.id ? '<div class="acts"><button type="button" class="btn danger" id="del">이 기록 지우기</button></div>' : ''}
    </div>`;
    const pv = $('#pv', sheet);
    if (pv) { if (blob) pv.src = URL.createObjectURL(blob); else store.photoURL(m.photo).then((u) => { if (u) pv.src = u; }); }
    sheet.querySelectorAll('[data-slot]').forEach((b) => (b.onclick = () => { m.memo = $('#memo', sheet).value; m.slot = b.dataset.slot; draw(); }));
    sheet.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { m.memo = $('#memo', sheet).value; m[b.dataset.t] = !m[b.dataset.t]; draw(); }));
    $('#cancel', sheet).onclick = closeSheet;
    $('#save', sheet).onclick = async () => {
      m.memo = $('#memo', sheet).value.trim();
      if (!m.id) m.id = store.newId();
      if (blob) { await store.putPhoto(m.id, blob); m.photo = m.id; }
      store.upsert('meals', m);
      closeSheet(); toast('기록했어요');
    };
    const del = $('#del', sheet);
    if (del) del.onclick = async () => {
      if (!confirm('이 기록을 지울까요?')) return;
      if (m.photo) await store.dropPhoto(m.photo);
      store.remove('meals', m.id);
      closeSheet(); toast('지웠어요');
    };
  };
  draw();
  sheet.hidden = false;
}
function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

// ---------- 주간 ----------
function renderWeek() {
  const end = addDays(weekStart, 6);
  const isThis = weekStart === monday(today());
  const c = weekCounts(weekStart), prev = weekCounts(addDays(weekStart, -7));
  let days = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (d > today()) break;
    const w = weightOn(d);
    days += `<div class="day"><h3>${md(d)} (${dow(d)})${w ? ` · ${w.kg}kg` : ''}</h3>${mealGrid(mealsOn(d))}</div>`;
  }
  view.innerHTML = `
    <div class="weeknav">
      <button class="btn ghost" id="prev" type="button">‹ 지난주</button>
      <b>${md(weekStart)} – ${md(end)}</b>
      <button class="btn ghost" id="next" type="button" ${isThis ? 'disabled' : ''}>다음 주 ›</button>
    </div>
    <div class="card"><h2>3가지 세기 <small>주 1회 5분</small></h2>${statsHTML(c, prev)}</div>
    <div class="card"><h2>사진 넘겨 보기</h2>
      <p class="hint">반복되는 장면이 있나요? (예: 술자리 다음 날 배달, 매일 4시 간식) 있다면 다음 주에 하나만 바꿔 보기.</p>
      ${days}
    </div>`;
  $('#prev').onclick = () => { weekStart = addDays(weekStart, -7); render(); };
  $('#next').onclick = () => { if (!isThis) { weekStart = addDays(weekStart, 7); render(); } };
}

// ---------- 몸 ----------
function rolling(byDate, d) {
  const v = [];
  for (let i = 0; i < 7; i++) { const x = byDate.get(addDays(d, -i)); if (x != null) v.push(x); }
  return v.length >= 3 ? avg(v) : null;
}
function weightChart() {
  const ws = store.list('weights').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (ws.length < 2) return '<p class="hint">체중을 이틀 이상 기록하면 그래프가 보여요.</p>';
  const byDate = new Map(ws.map((w) => [w.date, w.kg]));
  const end = today(), start0 = addDays(end, -62);
  const start = ws[0].date > start0 ? ws[0].date : start0;
  const nDays = Math.round((parse(end) - parse(start)) / 864e5) + 1;
  const pts = ws.filter((w) => w.date >= start);
  const goal = store.S.goal1;
  const vals = pts.map((w) => w.kg).concat(goal ? [goal] : []);
  let lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const W = 340, H = 180, L = 30, R = 8, T = 8, B = 20;
  const x = (d) => L + ((parse(d) - parse(start)) / 864e5) * (W - L - R) / Math.max(1, nDays - 1);
  const y = (v) => T + (hi - v) * (H - T - B) / (hi - lo);
  let grid = '';
  const step = hi - lo > 8 ? 2 : 1;
  for (let v = lo; v <= hi; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  const periods = store.list('periods').filter((p) => p.date >= start).map((p) => `<line x1="${x(p.date)}" x2="${x(p.date)}" y1="${T}" y2="${H - B}" stroke="var(--warn)" stroke-dasharray="2 3" opacity=".6"/>`).join('');
  const goalLine = goal && goal >= lo && goal <= hi ? `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--point)" stroke-dasharray="5 4"/><text x="${W - R}" y="${y(goal) - 4}" text-anchor="end" style="fill:var(--point)">1차 목표 ${goal}</text>` : '';
  let path = '', pen = false;
  for (let i = 0; i < nDays; i++) {
    const d = addDays(start, i), r = rolling(byDate, d);
    if (r == null) { pen = false; continue; }
    path += `${pen ? 'L' : 'M'}${x(d).toFixed(1)},${y(r).toFixed(1)}`; pen = true;
  }
  const dots = pts.map((w) => `<circle cx="${x(w.date)}" cy="${y(w.kg)}" r="2.5" fill="var(--muted)"/>`).join('');
  const lbl = `<text x="${L}" y="${H - 4}">${md(start)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${md(end)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="체중 그래프">${grid}${periods}${goalLine}${dots}<path d="${path}" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round"/>${lbl}</svg>
    <div class="legend"><span><i style="background:var(--muted)"></i>매일 체중</span><span><i style="background:var(--ink)"></i>7일 평균 (이걸로 판단)</span><span><i style="background:var(--warn)"></i>생리 시작</span></div>`;
}
function bpSummary() {
  const S = store.S;
  const bs = store.list('bps').slice().sort((a, b) => a.ts - b.ts);
  if (!bs.length) return '<p class="hint">첫 7일은 아침(일어나서 1시간 안·아침 전)과 저녁(자기 전)에 1분 간격으로 2번씩 재 주세요. 등을 기대고 5분 쉰 뒤, 운동·술 직후 30분은 피하기.</p>';
  const m = (r) => [avg(r.r.map((x) => x[0])), avg(r.r.map((x) => x[1]))];
  const first = bs[0].date, baseEnd = addDays(first, 6);
  const base = bs.filter((b) => b.date <= baseEnd).map(m);
  const recentFrom = addDays(today(), -6);
  const recent = bs.filter((b) => b.date >= recentFrom).map(m);
  const show = (arr) => (arr.length ? `${f0(avg(arr.map((v) => v[0])))}/${f0(avg(arr.map((v) => v[1])))}` : '–');
  const over = (arr) => arr.length && (avg(arr.map((v) => v[0])) >= S.bpSys || avg(arr.map((v) => v[1])) >= S.bpDia);
  const baseDone = today() > baseEnd;
  return `<div class="stats">
    <div class="stat ${over(base) ? 'warn' : ''}"><div class="k">기준선 (첫 7일)</div><div class="v">${show(base)}</div><div class="s">${baseDone ? `${md(first)}–${md(baseEnd)}` : `${md(baseEnd)}까지 측정 중`}</div></div>
    <div class="stat ${over(recent) ? 'warn' : ''}"><div class="k">최근 7일 평균</div><div class="v">${show(recent)}</div><div class="s">기준 ${S.bpSys}/${S.bpDia} 미만</div></div>
  </div>
  ${over(recent) || (baseDone && over(base)) ? `<p class="hint bad" style="margin-top:8px">평균이 ${S.bpSys}/${S.bpDia} 이상이에요. 진료를 받아 보시길 권해요.</p>` : ''}
  <p class="hint" style="margin-top:8px">${baseDone ? '기준선 이후엔 주 2회(예: 수·일 아침)면 충분해요.' : '첫 7일은 아침·저녁 매일 재 주세요.'}</p>`;
}
function renderBody() {
  const ws = store.list('weights').slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const byDate = new Map(ws.map((w) => [w.date, w.kg]));
  const nowAvg = rolling(byDate, today());
  const firstW = ws.length ? ws[ws.length - 1] : null;
  const bs = store.list('bps').slice().sort((a, b) => b.ts - a.ts).slice(0, 8);
  const ms = store.list('measures').slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const ps = store.list('periods').slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  const S = store.S;
  view.innerHTML = `
    <div class="card"><h2>체중 <small>최근 9주</small></h2>${weightChart()}
      <p class="hint" style="margin-top:8px">지금 7일 평균 <b>${f1(nowAvg)}kg</b>${firstW && nowAvg != null ? ` · 시작(${md(firstW.date)} ${firstW.kg}kg)보다 ${(nowAvg - firstW.kg > 0 ? '+' : '') + (nowAvg - firstW.kg).toFixed(1)}kg` : ''} · 1차 목표 ${S.goal1}kg</p>
      <p class="hint">하루하루 숫자보다 <b>평균선의 방향</b>을 보세요. 생리 무렵엔 1~2kg 오르내리는 게 정상이고 대부분 수분이에요. 달끼리 비교할 땐 같은 주기 시점끼리.</p>
      <div class="list" style="margin-top:8px">${ws.slice(0, 7).map((w) => `<div class="li"><span>${md(w.date)} (${dow(w.date)})</span><span>${w.kg}kg <button class="x" data-del="weights:${w.id}" type="button">지우기</button></span></div>`).join('')}</div>
    </div>

    <div class="card"><h2>생리 시작일 <small>체중 해석용</small></h2>
      <div class="row"><input type="date" id="pDate" value="${today()}" max="${today()}" class="grow"><button class="btn" id="pSave" type="button">시작일로 기록</button></div>
      <div class="list" style="margin-top:8px">${ps.map((p) => `<div class="li"><span>${p.date}</span><button class="x" data-del="periods:${p.id}" type="button">지우기</button></div>`).join('')}</div>
    </div>

    <div class="card"><h2>혈압</h2>${bpSummary()}
      <div style="margin-top:12px;display:grid;gap:8px">
        <div class="row"><input type="date" id="bDate" value="${today()}" max="${today()}" class="grow">
          <div class="chips" id="bPart"><button type="button" class="chip ${new Date().getHours() < 15 ? 'on' : ''}" data-p="아침">아침</button><button type="button" class="chip ${new Date().getHours() >= 15 ? 'on' : ''}" data-p="저녁">저녁</button></div></div>
        <div class="row"><span class="hint" style="width:44px">1번째</span><input type="number" inputmode="numeric" id="s1" placeholder="위(수축기)" class="grow"><input type="number" inputmode="numeric" id="d1" placeholder="아래(이완기)" class="grow"></div>
        <div class="row"><span class="hint" style="width:44px">2번째</span><input type="number" inputmode="numeric" id="s2" placeholder="1분 뒤" class="grow"><input type="number" inputmode="numeric" id="d2" placeholder="1분 뒤" class="grow"></div>
        <button class="btn primary" id="bSave" type="button">혈압 저장</button>
      </div>
      <div class="list" style="margin-top:8px">${bs.map((b) => `<div class="li"><span>${md(b.date)} ${b.part}</span><span>${b.r.map((x) => `${x[0]}/${x[1]}`).join(' · ')} <button class="x" data-del="bps:${b.id}" type="button">지우기</button></span></div>`).join('')}</div>
    </div>

    <div class="card"><h2>허리둘레 · 인바디 <small>월 1회</small></h2>
      <div style="display:grid;gap:8px">
        <input type="date" id="mDate" value="${today()}" max="${today()}">
        <div class="row"><div class="grow"><label class="f">허리둘레(cm) · 배꼽 높이, 숨 내쉰 뒤</label><input type="number" inputmode="decimal" step="0.1" id="waist"></div></div>
        <div class="row">
          <div class="grow"><label class="f">인바디 체중</label><input type="number" inputmode="decimal" step="0.1" id="iw"></div>
          <div class="grow"><label class="f">골격근량</label><input type="number" inputmode="decimal" step="0.1" id="smm"></div>
          <div class="grow"><label class="f">체지방률%</label><input type="number" inputmode="decimal" step="0.1" id="bf"></div>
        </div>
        <button class="btn primary" id="mSave" type="button">저장</button>
      </div>
      <div class="list" style="margin-top:8px">${ms.map((m) => `<div class="li"><span>${m.date}</span><span>${[m.waist != null ? `허리 ${m.waist}` : '', m.smm != null ? `골격근 ${m.smm}` : '', m.bf != null ? `체지방 ${m.bf}%` : ''].filter(Boolean).join(' · ')} <button class="x" data-del="measures:${m.id}" type="button">지우기</button></span></div>`).join('')}</div>
      <p class="hint" style="margin-top:6px">골격근량이 유지되면 빠진 게 지방이라는 뜻이에요.</p>
    </div>`;

  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
    const [k, id] = b.dataset.del.split(':');
    if (confirm('지울까요?')) store.remove(k, id);
  }));
  $('#pSave').onclick = () => { const d = $('#pDate').value; if (!d) return; store.upsert('periods', { id: 'p' + d, date: d }); toast('기록했어요'); };
  $('#bPart').querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { $('#bPart').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); }));
  $('#bSave').onclick = () => {
    const r = [[num($('#s1').value), num($('#d1').value)], [num($('#s2').value), num($('#d2').value)]].filter(([s, d]) => s && d);
    if (!r.length) { toast('위·아래 숫자를 넣어 주세요'); return; }
    if (r.some(([s, d]) => s < 60 || s > 250 || d < 30 || d > 160 || d >= s)) { toast('숫자를 확인해 주세요'); return; }
    const part = $('#bPart .chip.on')?.dataset.p || '아침';
    store.upsert('bps', { date: $('#bDate').value || today(), part, ts: Date.now(), r });
    toast('혈압을 저장했어요');
  };
  $('#mSave').onclick = () => {
    const m = { date: $('#mDate').value || today(), waist: num($('#waist').value), iw: num($('#iw').value), smm: num($('#smm').value), bf: num($('#bf').value) };
    if ([m.waist, m.iw, m.smm, m.bf].every((v) => v == null)) { toast('하나 이상 넣어 주세요'); return; }
    store.upsert('measures', { id: 'm' + m.date, ...m });
    toast('저장했어요');
  };
}

// ---------- 설정 ----------
function renderSettings() {
  const S = store.S, c = store.conn;
  view.innerHTML = `
    <div class="card"><h2>저장소 연결 <small>${store.connected ? '연결됨' : '기기에만 저장 중'}</small></h2>
      <p class="hint">연결하지 않아도 이 휴대폰에는 저장돼요. 연결하면 비공개 저장소에도 보관돼서 휴대폰을 바꿔도 남아요.</p>
      <div style="margin-top:10px;display:grid;gap:8px">
        <input type="password" id="tok" placeholder="github_pat_로 시작하는 접근 키" value="${esc(c.token)}" autocomplete="off">
        <div class="row"><button class="btn primary grow" id="tSave" type="button">저장하고 확인</button>${c.token ? '<button class="btn danger" id="tDel" type="button">이 기기에서 지우기</button>' : ''}</div>
        <p class="hint" id="tMsg">${store.status === 'error' ? esc(store.statusText) : ''}</p>
      </div>
      <details style="margin-top:6px"><summary class="hint">접근 키 만드는 법 (저장소 주인이 한 번)</summary>
        <ol class="steps">
          <li>GitHub → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token</li>
          <li>Repository access = <b>Only select repositories</b> → <code>${esc(c.owner)}/${esc(c.repo)}</code> 하나만</li>
          <li>Permissions → Repository → <b>Contents: Read and write</b> · 만료일은 넉넉히(예: 1년)</li>
          <li>만든 키를 이 칸에 붙여 넣고 «저장하고 확인» → «연결됐어요»가 뜨면 끝</li>
        </ol>
      </details>
    </div>
    <div class="card"><h2>기준값 <small>여기서 바꿀 수 있어요</small></h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label class="f">1차 목표 체중(kg)</label><input type="number" step="0.1" id="g1" value="${S.goal1}"></div>
        <div><label class="f">최종 목표 체중(kg)</label><input type="number" step="0.1" id="g2" value="${S.goal2}"></div>
        <div><label class="f">주당 술자리 상한</label><input type="number" id="dm" value="${S.drinkMax}"></div>
        <div></div>
        <div><label class="f">혈압 기준 위</label><input type="number" id="bs" value="${S.bpSys}"></div>
        <div><label class="f">혈압 기준 아래</label><input type="number" id="bd" value="${S.bpDia}"></div>
      </div>
      <button class="btn primary" id="sSave" type="button" style="margin-top:10px;width:100%">기준값 저장</button>
    </div>
    <div class="card"><h2>백업</h2>
      <p class="hint">기록(사진 제외)을 파일로 내려받아요.</p>
      <button class="btn" id="exp" type="button" style="margin-top:8px">기록 파일로 받기</button>
    </div>
    <p class="hint" style="text-align:center">홈 화면에 추가하면 앱처럼 쓸 수 있어요 (사파리 공유 → 홈 화면에 추가)</p>`;
  $('#tSave').onclick = async () => {
    const token = $('#tok').value.trim();
    store.setConn({ token });
    $('#tMsg').textContent = '확인 중…';
    try { await store.test(); $('#tMsg').textContent = '연결됐어요 ✓'; store.sync(); } catch (e) { $('#tMsg').textContent = e.message; }
  };
  const td = $('#tDel'); if (td) td.onclick = () => { if (confirm('이 기기에서 접근 키를 지울까요? (기록은 남아요)')) { store.setConn({ token: '' }); store.setStatus('local'); render(); } };
  $('#sSave').onclick = () => {
    const v = { goal1: num($('#g1').value), goal2: num($('#g2').value), drinkMax: num($('#dm').value), bpSys: num($('#bs').value), bpDia: num($('#bd').value) };
    for (const [k, x] of Object.entries(v)) if (x != null) S[k] = x;
    store.saveSettings(); toast('저장했어요');
  };
  $('#exp').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' }));
    a.download = `습관기록_${today()}.json`; a.click();
  };
}

// ---------- 뼈대 ----------
function render() {
  $('#title').textContent = TITLES[tab];
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ({ today: renderToday, week: renderWeek, body: renderBody, settings: renderSettings })[tab]();
  hydratePhotos();
}
function renderStatus() {
  const b = $('#sync');
  const t = { local: '기기에만 저장', syncing: '저장 중…', synced: `저장됨 ${store.statusText}`, error: '저장 실패' }[store.status];
  b.textContent = t; b.className = 'sync' + (store.status === 'error' ? ' err' : store.status === 'synced' ? ' ok' : '');
}
$('#sync').onclick = () => { if (store.connected && store.status !== 'error') store.sync(); else { tab = 'settings'; render(); } };
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; if (tab === 'week') weekStart = monday(today()); window.scrollTo(0, 0); render(); }));

store.onChange = (fromSync) => {
  if (fromSync && (document.activeElement?.matches('input, textarea') || !sheet.hidden)) return;
  render();
};
store.onStatus = renderStatus;

// 링크로 접근 키 받기: …/#key=github_pat_xxx (주소 뒷부분은 서버로 가지 않음) → 저장 후 주소에서 지움
const hm = location.hash.match(/key=([A-Za-z0-9_]+)/);
if (hm) { store.setConn({ token: hm[1] }); history.replaceState(null, '', location.pathname); }
store.init();
render(); renderStatus();
if (hm) store.test().then(() => toast('연결됐어요 ✓')).catch((e) => toast(e.message));
