/* 골라골라 프론트엔드: 슈퍼관리자 > 프로젝트 > 업무(주문) / 관리자(승인제) / 참여자 */
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const params = new URLSearchParams(location.search);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const won = n => n ? n.toLocaleString() + '원' : '';
let auth = null;   // 승인된 로그인 사용자 {id, role, name} (supa.js 의 loadMe() 결과)

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el[k] = v;
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
// api() 는 supa.js 에 있다 (Supabase 호출로 변환)
const go = url => { location.href = url; };
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter(k => k != null && k !== false));   // replaceChildren(null)은 "null" 글자를 찍으므로 걸러서 사용
const roleLabel = r => r === 'super' ? '슈퍼관리자' : '관리자';

/* ---------------- 상단 바 ---------------- */
function renderNav() {
  const nav = $('#nav');
  nav.append(h('a', { class: 'brand', href: './' }, '☕ 골라골라'));
  if (auth) {
    nav.append(h('span', { class: 'who' }, `${auth.name} (${roleLabel(auth.role)})`));
    if (auth.role === 'super') nav.append(h('a', { class: 'btn ghost sm', href: '?view=super' }, '슈퍼관리자 콘솔'));
    nav.append(h('a', { class: 'btn ghost sm', href: '?view=admin' }, '업무 관리'),
      h('button', { class: 'ghost sm', onclick: async () => { try { await api('/api/auth/logout', {}); } catch {} go('./'); } }, '로그아웃'));
  } else nav.append(h('a', { class: 'btn ghost sm', href: '?view=login' }, '관리자 로그인 / 권한 요청'));
}

/* ---------------- 로그인 / 관리자 요청 ---------------- */
function renderLogin() {
  const email = h('input', { type: 'text', placeholder: '이메일' }), pw = h('input', { type: 'password', placeholder: '비밀번호' });
  const msg = h('div', { class: 'msg err' });
  async function login() {
    msg.textContent = '';
    try {
      const r = await api('/api/auth/login', { email: email.value, password: pw.value });
      go(r.role === 'super' ? '?view=super' : '?view=admin');
    } catch (e) { msg.textContent = e.message; }
  }
  pw.addEventListener('keydown', e => e.key === 'Enter' && login());

  const re = h('input', { type: 'text', placeholder: '이메일 (로그인 아이디로 사용)' }), rn = h('input', { type: 'text', placeholder: '표시할 이름 (2~20자)' }),
    rp = h('input', { type: 'password', placeholder: '비밀번호 (6자 이상)' }), rnote = h('input', { type: 'text', placeholder: '소속/사유 (선택) 예: 3팀 점심 취합 담당' });
  const rmsg = h('div', { class: 'msg' });
  app.append(
    h('div', { class: 'card' }, h('h2', {}, '관리자 / 슈퍼관리자 로그인'), h('label', {}, '이메일'), email, h('label', {}, '비밀번호'), pw,
      h('div', { style: 'margin-top:10px' }, h('button', { onclick: login }, '로그인')), msg),
    h('div', { class: 'card' }, h('h2', {}, '관리자 권한 요청'),
      h('div', { class: 'sub' }, '음료 취합을 직접 운영하려면 요청하세요. 슈퍼관리자가 승인하고 프로젝트를 배정하면 로그인해서 업무를 만들 수 있습니다.'),
      h('label', {}, '이메일'), re, h('label', {}, '이름'), rn, h('label', {}, '비밀번호'), rp, h('label', {}, '메모'), rnote,
      h('div', { style: 'margin-top:10px' }, h('button', { onclick: async () => {
        rmsg.className = 'msg err'; rmsg.textContent = '';
        try { await api('/api/admin-requests', { email: re.value, name: rn.value, password: rp.value, note: rnote.value });
          rmsg.className = 'msg'; rmsg.textContent = '요청이 접수되었습니다. 슈퍼관리자가 승인하면 위에서 로그인할 수 있어요.'; rp.value = ''; }
        catch (e) { rmsg.textContent = e.message; } } }, '관리자 권한 요청하기')), rmsg));
}

/* ---------------- 참여자 홈: 프로젝트/관리자별 업무 선택 ---------------- */
async function renderHome() {
  const [{ projects }, { tasks }] = await Promise.all([api('/api/projects'), api('/api/tasks')]);
  const projSel = h('select', { onchange: draw }, h('option', { value: '' }, '전체 프로젝트'), projects.map(p => h('option', { value: p.id }, `${p.name} (진행 ${p.openCount})`)));
  const owners = [...new Set(tasks.map(t => t.owner))].sort();
  const ownSel = h('select', { onchange: draw }, h('option', { value: '' }, '전체 관리자'), owners.map(o => h('option', { value: o }, o)));
  const list = h('div');
  function draw() {
    const rows = tasks.filter(t => (!projSel.value || t.projectId === projSel.value) && (!ownSel.value || t.owner === ownSel.value))
      .sort((a, b) => (a.closed - b.closed) || b.created.localeCompare(a.created));
    list.replaceChildren(...(rows.length ? rows.map(t => h('a', { class: 'task item-row', href: '?task=' + t.id },
      h('b', {}, t.title), ' ', t.closed ? h('span', { class: 'badge' }, '마감') : h('span', { class: 'badge ok' }, '진행중'),
      h('div', { class: 'sub' }, h('span', { class: 'tag' }, t.projectName), h('span', { class: 'tag' }, '관리자 ' + t.owner), (t.store ? t.store + ' · ' : '') + `참여 ${t.count}명`)))
      : [h('div', { class: 'sub' }, '조건에 맞는 업무가 없어요.')]));
  }
  app.append(h('h1', {}, '어떤 주문에 참여할까요?'), h('div', { class: 'sub' }, '프로젝트와 관리자를 고르고, 업무를 눌러 음료를 "선택"하세요.'),
    h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, projSel), h('div', { class: 'grow' }, ownSel)), list));
  draw();
}

/* ---------------- 메뉴 입력 도구 (OCR / 파싱) ---------------- */
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); }); }
function parseOcr(raw) {
  const out = [];
  for (let line of raw.split(/\r?\n/)) {
    line = line.replace(/[·•…]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/[가-힣A-Za-z]{2,}/.test(line)) continue;
    const m = line.match(/^(.*?)[\s.]*(\d{1,3}(?:,\d{3})+|\d{4,5})\s*원?$/);
    let name = m ? m[1] : line, price = m ? m[2].replace(/,/g, '') : '';
    if (price && +price < 500) price = '';
    name = name.replace(/[|_~=*]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 2) continue;
    out.push(price ? `${name} | ${price}` : name);
  }
  return out.join('\n');
}
function parseMenu(text) {
  let cat = '', items = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('#')) { cat = line.replace(/^#+\s*/, ''); continue; }
    const [name, price] = line.split('|').map(s => s.trim());
    if (name) items.push({ name, price: parseInt((price || '').replace(/[^\d]/g, '')) || 0, category: cat });
  }
  return items;
}
const itemsToText = items => { const g = {}; for (const i of items) (g[i.category] ||= []).push(i.name); return Object.entries(g).map(([c, n]) => (c ? '# ' + c + '\n' : '') + n.join('\n')).join('\n\n'); };

/* ---------------- 업무 만들기 폼 ---------------- */
async function newTaskForm(project, onCreated) {
  let mode = 'franchise', brands = [];
  try { brands = (await api('/api/franchises')).brands; } catch {}
  const title = h('input', { type: 'text', value: new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ' 음료 주문' });
  const store = h('input', { type: 'text', placeholder: '가게 이름 (선택)' });
  const editor = h('textarea', { placeholder: '한 줄에 메뉴 하나. 가격은 | 뒤에 (선택)\n# 으로 시작하는 줄은 분류 이름\n\n# 커피\n아이스 아메리카노 | 4500' });
  const brandSel = h('select', { onchange: () => { const b = brands.find(x => x.id === brandSel.value); fetchBtn.disabled = !b; if (b) { store.value = b.name; link.href = b.url; link.textContent = '공식 메뉴 페이지 ↗'; link.style.display = 'inline'; } } },
    h('option', { value: '' }, '-- 프랜차이즈 선택 --'), brands.map(b => h('option', { value: b.id }, b.name + (b.live ? '' : ' (기본 목록)'))));
  const link = h('a', { target: '_blank', class: 'sub', style: 'display:none; margin-left:8px' });
  const fmsg = h('div', { class: 'msg' });
  const fetchBtn = h('button', { disabled: true, onclick: async () => {
    const b = brands.find(x => x.id === brandSel.value); if (!b) return;
    fetchBtn.disabled = true; fmsg.className = 'msg'; fmsg.textContent = '공식 홈페이지에서 메뉴를 가져오는 중…';
    try {
      const res = await api('/api/franchise/run', { id: b.id });
      editor.value = itemsToText(res.items);
      const warn = res.warnings.length ? ' ⚠ ' + res.warnings.join(' / ') : '';
      fmsg.className = 'msg' + (res.source === 'live' && !warn ? '' : ' err');
      fmsg.textContent = (res.source === 'live' ? `✔ 홈페이지에서 실시간으로 ${res.items.length}개 메뉴를 가져왔어요 (${res.fetchedAt.replace('T', ' ')}). ` : `기본 목록 ${res.items.length}개를 불러왔어요. `)
        + '아래 목록을 확인하고 필요 없는 메뉴는 지우세요. (공식 사이트는 가격을 제공하지 않아 가격은 비어 있습니다)' + warn;
    } catch (e) { fmsg.className = 'msg err'; fmsg.textContent = e.message; }
    fetchBtn.disabled = false;
  } }, '홈페이지에서 메뉴 가져오기');
  const fr = h('div', {}, h('label', {}, '프랜차이즈'), h('div', { class: 'row' }, h('div', { class: 'grow' }, brandSel), fetchBtn, link), fmsg);

  const fileIn = h('input', { type: 'file', accept: 'image/*', onchange: () => { const f = fileIn.files[0]; if (!f) return; preview.src = URL.createObjectURL(f); preview.classList.remove('hidden'); ocrBtn.disabled = false; } });
  const preview = h('img', { class: 'preview hidden' });
  const bar = h('div', { class: 'bar hidden' }, h('i')), ocrMsg = h('div', { class: 'msg' });
  const ocrBtn = h('button', { class: 'ghost', disabled: true, onclick: async () => {
    const f = fileIn.files[0]; if (!f) return;
    ocrBtn.disabled = true; bar.classList.remove('hidden'); ocrMsg.textContent = 'OCR 엔진 불러오는 중… (처음엔 한글 학습데이터 다운로드로 1분 정도 걸릴 수 있어요)';
    try {
      if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      const res = await Tesseract.recognize(f, 'kor+eng', { logger: m => { ocrMsg.textContent = '인식 중… ' + (m.status || '') + ' ' + Math.round((m.progress || 0) * 100) + '%'; $('i', bar).style.width = Math.round((m.progress || 0) * 100) + '%'; } });
      const text = parseOcr(res.data.text);
      editor.value = (editor.value.trim() ? editor.value.trim() + '\n' : '') + text;
      ocrMsg.textContent = text ? '인식 완료! 아래 목록에서 잘못 읽힌 글자/가격을 수정하세요.' : '메뉴를 찾지 못했어요. 더 선명한 이미지를 쓰거나 직접 입력해 주세요.';
    } catch { ocrMsg.textContent = 'OCR을 실행하지 못했습니다(인터넷 차단 등). 메뉴를 아래 목록에 직접 입력해 주세요.'; }
    ocrBtn.disabled = false; bar.classList.add('hidden');
  } }, '메뉴판에서 메뉴 인식하기');
  const own = h('div', { class: 'hidden' }, h('label', {}, '메뉴판 이미지 (사진/스크린샷)'), fileIn, preview, h('div', { style: 'margin-top:8px' }, ocrBtn), bar, ocrMsg,
    h('div', { class: 'sub', style: 'margin-top:6px' }, '이미지는 내 브라우저에서만 처리되고 서버로 전송되지 않습니다. 인식 결과는 오류가 있을 수 있으니 꼭 확인·수정하세요.'));

  const tabF = h('button', { onclick: () => setMode('franchise') }, '프랜차이즈'), tabO = h('button', { class: 'ghost', onclick: () => setMode('own') }, '개인 카페 (메뉴판 이미지)');
  function setMode(m) { mode = m; fr.classList.toggle('hidden', m !== 'franchise'); own.classList.toggle('hidden', m !== 'own'); tabF.className = m === 'franchise' ? '' : 'ghost'; tabO.className = m === 'own' ? '' : 'ghost'; }
  const err = h('div', { class: 'msg err' });
  const createBtn = h('button', { onclick: async () => {
    createBtn.disabled = true; err.textContent = '';
    try { const r = await api('/api/tasks', { projectId: project.id, title: title.value, store: store.value, menu: parseMenu(editor.value) }); onCreated(r.id); }
    catch (e) { err.textContent = e.message; createBtn.disabled = false; }
  } }, '업무 만들기');
  return h('div', {},
    h('div', { class: 'card' }, h('h2', {}, `새 업무 만들기 · ${project.name}`), h('label', {}, '업무 이름'), title, h('label', {}, '가게'), store, h('div', { class: 'tabs' }, tabF, tabO), fr, own),
    h('div', { class: 'card' }, h('h2', {}, '메뉴 목록 (수정 가능)'), editor, h('div', { class: 'sub' }, '형식: 한 줄에 "메뉴명 | 가격", "# 분류명" 줄로 그룹 구분. 팀원에게 링크를 보내기 전에 여기서 확인하세요.'), err, h('div', { style: 'margin-top:10px' }, createBtn)));
}

/* ---------------- 관리 콘솔 (관리자/슈퍼관리자): 프로젝트 안에서 업무 관리 ---------------- */
async function renderAdmin() {
  if (!auth) return go('?view=login');
  const { projects } = await api('/api/my/projects');
  if (!projects.length) {
    app.append(h('h1', {}, '업무 관리'), h('div', { class: 'card' }, auth.role === 'super' ? '프로젝트가 없습니다. 슈퍼관리자 콘솔에서 프로젝트를 먼저 만드세요.' : '아직 배정된 프로젝트가 없어요. 슈퍼관리자가 프로젝트를 배정하면 업무를 만들 수 있습니다.'));
    return;
  }
  const last = localStorage.getItem('lastProject');
  const sel = h('select', { onchange: () => { localStorage.setItem('lastProject', sel.value); draw(); } }, projects.map(p => h('option', { value: p.id, selected: p.id === last }, p.name)));
  const body = h('div');
  async function draw() {
    const p = projects.find(x => x.id === sel.value);
    const { tasks } = await api('/api/tasks?project=' + p.id);
    let formBox = h('div');
    const newBtn = h('button', { onclick: async () => { newBtn.disabled = true; formBox.replaceChildren(await newTaskForm(p, id => go('?task=' + id))); } }, '+ 새 업무 만들기');
    body.replaceChildren(
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { style: 'margin:0;flex:1' }, `${p.name} 의 업무`), newBtn),
        tasks.length ? tasks.map(t => h('a', { class: 'task item-row', href: '?task=' + t.id }, h('b', {}, t.title), ' ', t.closed ? h('span', { class: 'badge' }, '마감') : h('span', { class: 'badge ok' }, '진행중'),
          t.owner === auth.name ? h('span', { class: 'tag', style: 'margin-left:6px' }, '내 업무') : null,
          h('div', { class: 'sub' }, h('span', { class: 'tag' }, '관리자 ' + t.owner), (t.store ? t.store + ' · ' : '') + `참여 ${t.count}명`))) : h('div', { class: 'sub', style: 'margin-top:8px' }, '아직 업무가 없어요. 새 업무를 만들어 보세요.')),
      formBox);
  }
  app.append(h('h1', {}, '업무 관리'), h('div', { class: 'sub' }, '프로젝트를 고르고 그 안에서 음료 취합 업무를 만들고 관리하세요.'), h('div', { class: 'card' }, h('label', { style: 'margin-top:0' }, '프로젝트'), sel), body);
  draw().catch(e => body.append(h('div', { class: 'card msg err' }, e.message)));
}

/* ---------------- 슈퍼관리자 콘솔 ---------------- */
async function renderSuper() {
  if (!auth || auth.role !== 'super') return go('?view=login');
  const box = h('div');
  app.append(h('h1', {}, '슈퍼관리자 콘솔'), box);
  async function draw() {
    const [{ admins }, { projects }] = await Promise.all([api('/api/admins'), api('/api/projects')]);
    const act = (id, a, confirmMsg) => async () => { if (confirmMsg && !confirm(confirmMsg)) return; try { await api(`/api/admins/${id}/${a}`, {}); draw(); } catch (e) { alert(e.message); } };
    const pending = admins.filter(a => a.status === 'pending'), approved = admins.filter(a => a.status === 'approved'), rejected = admins.filter(a => a.status === 'rejected');
    const row = (a, btns) => h('div', { class: 'item-row row' }, h('div', { class: 'grow' }, h('b', {}, a.name), h('span', { class: 'sub' }, '  ' + a.email), a.note ? h('span', { class: 'sub' }, ' · ' + a.note) : null,
      h('div', { class: 'sub' }, '요청 ' + a.requestedAt.replace('T', ' ') + (a.projects.length ? ' · 프로젝트: ' + a.projects.join(', ') : ''))), btns);

    const newProj = h('input', { type: 'text', placeholder: '새 프로젝트 이름' });
    const projCards = projects.map(p => {
      const nm = h('input', { type: 'text', value: p.name });
      const checks = approved.map(a => { const c = h('input', { type: 'checkbox', checked: p.admins.includes(a.id) }); c.dataset.id = a.id; return h('label', { class: 'chk' }, c, a.name); });
      return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, nm),
        h('button', { class: 'sm', onclick: async () => { try { await api(`/api/projects/${p.id}/update`, { name: nm.value, admins: [...$$('input[type=checkbox]', cardOf(nm)).filter(c => c.checked).map(c => c.dataset.id)] }); draw(); } catch (e) { alert(e.message); } } }, '저장'),
        h('button', { class: 'danger sm', onclick: async () => { if (confirm(`"${p.name}" 프로젝트와 안의 모든 업무(${p.taskCount}개)를 삭제할까요?`)) { await api(`/api/projects/${p.id}/delete`, {}); draw(); } } }, '삭제')),
        h('div', { class: 'sub', style: 'margin:8px 0 2px' }, `업무 ${p.taskCount}개 (진행 ${p.openCount}) · 이 프로젝트에서 업무를 관리할 관리자:`),
        approved.length ? h('div', {}, checks) : h('div', { class: 'sub' }, '승인된 관리자가 아직 없어요.'));
    });
    fill(box,
      h('div', { class: 'card' }, h('h2', {}, `관리자 권한 요청 ${pending.length ? '(' + pending.length + ')' : ''}`),
        pending.length ? pending.map(a => row(a, [h('button', { class: 'sm', onclick: act(a.id, 'approve') }, '승인'), h('button', { class: 'danger sm', onclick: act(a.id, 'reject') }, '거절')]))
          : h('div', { class: 'sub' }, '대기 중인 요청이 없습니다.')),
      h('div', { class: 'card' }, h('h2', {}, '승인된 관리자'),
        approved.length ? approved.map(a => row(a, h('button', { class: 'danger sm', onclick: act(a.id, 'revoke', `${a.name}님의 관리자 권한을 회수할까요?`) }, '권한 회수'))) : h('div', { class: 'sub' }, '없음')),
      rejected.length ? h('div', { class: 'card' }, h('h2', {}, '거절/회수됨'), rejected.map(a => row(a, [h('button', { class: 'sm', onclick: act(a.id, 'approve') }, '다시 승인'), h('button', { class: 'danger sm', onclick: act(a.id, 'delete', '기록을 삭제할까요?') }, '삭제')]))) : null,
      h('h2', { style: 'margin-top:22px' }, '프로젝트 관리'),
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, newProj), h('button', { onclick: async () => { try { await api('/api/projects', { name: newProj.value }); draw(); } catch (e) { alert(e.message); } } }, '프로젝트 만들기'))),
      projCards, !projects.length ? h('div', { class: 'sub' }, '아직 프로젝트가 없습니다.') : null);
  }
  const $$ = (s, el) => [...el.querySelectorAll(s)];
  const cardOf = el => el.closest('.card');
  draw().catch(e => app.append(h('div', { class: 'card msg err' }, e.message)));
}

/* ---------------- 업무(주문) 화면: 참여자 선택 + 관리자 취합 ---------------- */
async function renderTask(taskId) {
  let task = null, sig = '', lanUrls = [];
  const nameIn = h('input', { type: 'text', placeholder: '내 이름', value: localStorage.getItem('myName') || '', oninput: e => localStorage.setItem('myName', e.target.value.trim()) });
  const noteIn = h('input', { type: 'text', placeholder: '요청사항 (예: ICE, 샷추가, 시럽 빼고)', value: localStorage.getItem('myNote') || '', oninput: e => localStorage.setItem('myNote', e.target.value.trim()) });
  const head = h('div'), menuBox = h('div'), sumBox = h('div'), adminBox = h('div');
  try { lanUrls = (await api('/api/info')).urls; } catch {}
  const myUser = () => nameIn.value.trim();
  async function act(path, body) { try { task = await api(path, body); draw(true); } catch (e) { alert(e.message); } }
  async function refresh() {
    try { task = await api('/api/tasks/' + taskId); draw(); }
    catch { clearInterval(timer); app.replaceChildren(h('h1', {}, '종료되었거나 없는 업무예요'), h('div', { class: 'sub' }, '관리자가 취합을 종료하면 관련 데이터는 삭제됩니다.'), h('a', { href: './' }, '← 처음으로')); }
  }
  function select(itemId) {
    if (!myUser()) { alert('먼저 이름을 입력하세요'); nameIn.focus(); return; }
    act(`/api/tasks/${taskId}/select`, { user: myUser(), itemId, note: noteIn.value.trim() });
  }
  function shareLinks() {
    return [`${location.origin}${location.pathname}?task=${taskId}`];   // GitHub Pages 의 /저장소명/ 경로 포함
  }
  function summaryText(byItem, total) {
    const lines = [`[${task.projectName}] ${task.title}` + (task.store ? ` (${task.store})` : '')];
    for (const it of task.menu) if (byItem[it.id]) lines.push(`- ${it.name} × ${byItem[it.id].length} : ` + byItem[it.id].map(x => x.u + (x.note ? `(${x.note})` : '')).join(', '));
    if (total) lines.push('합계 ' + won(total));
    return lines.join('\n');
  }
  function draw(force) {
    const s = JSON.stringify(task);
    if (!force && s === sig) return; sig = s;
    const byItem = {}; for (const [u, o] of Object.entries(task.orders)) (byItem[o.itemId] ||= []).push({ u, note: o.note });
    const mine = task.orders[myUser()];
    fill(head, h('div', { class: 'sub' }, h('a', { href: './' }, '← 목록'), '  ', h('span', { class: 'tag' }, task.projectName), h('span', { class: 'tag' }, '관리자 ' + task.owner)),
      h('h1', {}, task.title), h('div', { class: 'sub' }, (task.store ? task.store + ' · ' : '') + `참여 ${Object.keys(task.orders).length}명`),
      task.closed ? h('div', {}, h('span', { class: 'badge' }, '주문 마감')) : null);

    let lastCat = null; const rows = [];
    for (const it of task.menu) {
      if (it.category !== lastCat) { lastCat = it.category; if (it.category) rows.push(h('div', { class: 'cat' }, it.category)); }
      const sel = mine && mine.itemId === it.id;
      rows.push(h('div', { class: 'menu-item' + (sel ? ' sel' : '') }, h('div', { class: 'nm' }, it.name, it.price ? h('span', { class: 'price' }, '  ' + won(it.price)) : null),
        h('button', { class: sel ? 'ghost' : '', disabled: task.closed, onclick: () => select(sel ? null : it.id) }, sel ? '선택 취소' : '선택')));
    }
    menuBox.replaceChildren(h('div', { class: 'card' }, h('h2', {}, '메뉴'), rows));

    const total = task.menu.reduce((t, it) => t + it.price * (byItem[it.id] || []).length, 0);
    const picked = task.menu.filter(it => byItem[it.id]);
    sumBox.replaceChildren(h('div', { class: 'card' }, h('h2', {}, '메뉴별 선택 현황'),
      picked.length ? picked.map(it => h('div', { class: 'sumrow' }, h('b', {}, `${it.name} × ${byItem[it.id].length}`),
        h('div', {}, byItem[it.id].map(x => h('span', { class: 'chip' }, x.u, x.note ? h('small', {}, '(' + x.note + ')') : null,
          task.isManager ? h('a', { title: '이 사람 선택 삭제', onclick: () => confirm(x.u + '님의 선택을 삭제할까요?') && act(`/api/tasks/${taskId}/remove`, { user: x.u }) }, '×') : null)))))
        : h('div', { class: 'sub' }, '아직 선택한 사람이 없어요.'),
      total ? h('div', { style: 'margin-top:10px' }, h('b', {}, '합계 ' + won(total))) : null));

    fill(adminBox, task.isManager ? h('div', { class: 'card' }, h('h2', {}, '취합 관리'), h('label', { style: 'margin-top:0' }, '팀원에게 공유할 링크'),
      ...shareLinks().map(u => h('div', { class: 'row', style: 'margin-bottom:6px' }, h('div', { class: 'grow' }, h('input', { type: 'text', value: u, readOnly: true, onfocus: e => e.target.select() })),
        h('button', { class: 'ghost', onclick: () => navigator.clipboard.writeText(u).then(() => alert('복사됨')) }, '복사'))),
      h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', { class: 'ghost', onclick: () => navigator.clipboard.writeText(summaryText(byItem, total)).then(() => alert('주문 내역이 복사되었습니다')) }, '주문 내역 텍스트 복사'),
        task.closed ? h('button', { onclick: () => act(`/api/tasks/${taskId}/reopen`, {}) }, '마감 해제') : h('button', { class: 'danger', onclick: () => confirm('주문을 마감할까요?') && act(`/api/tasks/${taskId}/close`, {}) }, '주문 마감'),
        h('button', { class: 'danger', onclick: async () => {
          if (!confirm('취합을 종료하면 이 업무의 메뉴·선택 내역이 모두 삭제되고 되돌릴 수 없습니다.\n(프로젝트와 관리자 정보는 유지됩니다)\n\n필요하면 먼저 "주문 내역 텍스트 복사"로 저장하세요.\n\n취합을 종료할까요?')) return;
          try { await api(`/api/tasks/${taskId}/delete`, {}); alert('취합이 종료되고 관련 데이터가 삭제되었습니다.'); go('?view=admin'); } catch (e) { alert(e.message); }
        } }, '취합 종료 (데이터 삭제)')),
      h('div', { class: 'sub', style: 'margin-top:8px' }, '"주문 마감"은 선택만 막고 내역을 보관하며, "취합 종료"는 내역을 모두 삭제합니다.')) : null);
  }
  app.append(head, h('div', { class: 'card' }, h('label', { style: 'margin-top:0' }, '내 이름'), nameIn, h('label', {}, '요청사항 (선택)'), noteIn,
    h('div', { class: 'sub', style: 'margin-top:6px' }, '이름을 입력하고 아래 메뉴의 "선택"을 누르세요. 다른 메뉴를 누르면 바뀌고, 한 사람당 한 잔입니다.')), adminBox, sumBox, menuBox);
  nameIn.addEventListener('change', () => draw(true));
  await refresh();
  var timer = setInterval(refresh, 5000);
}

/* ---------------- 시작 ---------------- */
(async () => {
  if (typeof loadMe !== 'function') return;   // config.js 미설정 (supa.js 가 안내 문구를 표시함)
  try { auth = await loadMe(); } catch { auth = null; }
  renderNav();
  try {
    const view = params.get('view');
    if (params.get('task')) await renderTask(params.get('task'));
    else if (view === 'login') renderLogin();
    else if (view === 'admin') await renderAdmin();
    else if (view === 'super') await renderSuper();
    else await renderHome();
  } catch (e) { app.append(h('div', { class: 'card msg err' }, e.message)); }
})();
