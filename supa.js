/* Supabase 연동 계층: app.js 가 부르는 api('/api/...') 형태를 Supabase 호출로 바꿔 준다. */
const cfg = window.GOLA_CONFIG || {};
if (!cfg.SUPABASE_URL || /YOUR-PROJECT/.test(cfg.SUPABASE_URL)) {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('app').innerHTML = '<div class="card"><h2>설정이 필요합니다</h2><div class="sub">config.js 에 Supabase URL과 anon key 를 입력하세요. (README.md 참고)</div></div>';
  });
  throw new Error('config.js 미설정');
}
const supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
let me = null;   // 승인된 로그인 사용자 {id, role:'super'|'admin', name} / 없으면 null

function friendly(msg = '') {
  if (/row-level security|permission denied/i.test(msg)) return '권한이 없습니다';
  if (/invalid login/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (/already registered|already been registered/i.test(msg)) return '이미 가입된 이메일입니다';
  if (/database error saving new user|profiles_name_uq|duplicate key/i.test(msg)) return '이미 사용 중인 이름입니다';
  if (/password should be|at least/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다';
  if (/valid email|invalid format/i.test(msg)) return '올바른 이메일을 입력하세요';
  if (/rate limit|too many/i.test(msg)) return '요청이 너무 많습니다. 잠시 후 다시 시도하세요';
  if (/failed to fetch|networkerror/i.test(msg)) return '서버에 연결할 수 없습니다. 네트워크를 확인하세요';
  return msg;
}
function ck({ data, error }) { if (error) throw new Error(friendly(error.message)); return data; }

async function loadMe() {
  const { data: { session } } = await supa.auth.getSession();
  me = null;
  if (!session) return null;
  const { data } = await supa.from('profiles').select('id,name,role,status').eq('id', session.user.id).maybeSingle();
  if (data && data.status === 'approved') me = { id: data.id, role: data.role === 'super' ? 'super' : 'admin', name: data.name };
  return me;
}

const projCache = new Map();
async function projectName(id) {
  if (!projCache.has(id)) {
    const rows = ck(await supa.from('projects').select('id,name'));
    projCache.clear(); rows.forEach(r => projCache.set(r.id, r.name));
  }
  return projCache.get(id) || '(삭제된 프로젝트)';
}

async function projectViews() {
  const [P, T, A] = await Promise.all([
    supa.from('projects').select('id,name').order('name'),
    supa.from('tasks').select('id,project_id,closed'),
    supa.from('project_admins').select('project_id,admin_id'),
  ]);
  const projects = ck(P), tasks = ck(T), pas = ck(A);
  projects.forEach(p => projCache.set(p.id, p.name));
  return projects.map(p => {
    const mine = tasks.filter(t => t.project_id === p.id);
    return { id: p.id, name: p.name, admins: pas.filter(a => a.project_id === p.id).map(a => a.admin_id), taskCount: mine.length, openCount: mine.filter(t => !t.closed).length };
  });
}

async function taskView(id) {
  const t = ck(await supa.from('tasks').select('id,project_id,title,store,owner_id,owner_name,closed,menu,orders(user_name,item_id,note)').eq('id', id).maybeSingle());
  if (!t) throw new Error('업무를 찾을 수 없습니다');
  const orders = {}; for (const o of t.orders) orders[o.user_name] = { itemId: o.item_id, note: o.note };
  return { id: t.id, title: t.title, store: t.store, projectId: t.project_id, projectName: await projectName(t.project_id), owner: t.owner_name,
    menu: t.menu, orders, closed: t.closed, isManager: !!me && (me.role === 'super' || me.id === t.owner_id) };
}

async function staticBrands() { return (await (await fetch('franchises.json')).json()).brands; }

async function runFranchise(id) {
  const brands = await staticBrands();
  const b = brands.find(x => x.id === id);
  let warnings = [];
  if (b && b.live) {
    try {
      const { data, error } = await supa.functions.invoke('franchise', { body: { id } });
      if (error) throw new Error(error.message);
      if (data && !data.error && data.items.length >= 3) return data;
      warnings = [...(data?.warnings || []), data?.error || '홈페이지에서 메뉴를 충분히 가져오지 못했습니다'];
    } catch (e) { warnings = ['홈페이지 조회 실패: ' + e.message]; }
    warnings.push('기본 목록으로 대체했습니다.');
  } else warnings = ['이 브랜드는 실시간 조회를 지원하지 않아 기본 목록을 불러왔습니다. 공식 홈페이지를 보고 수정하세요.'];
  const items = []; const seen = new Set();
  for (const c of (b?.categories || [])) for (const n of c.items) if (!seen.has(n)) { seen.add(n); items.push({ category: c.name, name: n }); }
  return { source: 'static', items, warnings, fetchedAt: new Date().toISOString().slice(0, 19) };
}

function cleanMenu(list) {
  const menu = [];
  for (const it of list || []) {
    const name = String(it.name || '').trim().slice(0, 60);
    if (!name) continue;
    if (menu.length >= 300) break;
    menu.push({ id: 'm' + menu.length, name, price: parseInt(it.price) || 0, category: String(it.category || '').trim().slice(0, 30) });
  }
  return menu;
}

async function api(path, body) {
  const [p, qs] = path.split('?'); const q = new URLSearchParams(qs || ''); let m;

  if (p === '/api/info') return { urls: [] };
  if (p === '/api/me') return me ? { role: me.role, name: me.name } : { role: 'guest' };

  if (p === '/api/auth/login') {
    ck(await supa.auth.signInWithPassword({ email: String(body.email || '').trim(), password: String(body.password || '') }));
    if (!(await loadMe())) {
      const { data: { session } } = await supa.auth.getSession();
      const prof = session && ck(await supa.from('profiles').select('status').eq('id', session.user.id).maybeSingle());
      await supa.auth.signOut();
      throw new Error(prof?.status === 'pending' ? '아직 슈퍼관리자의 승인을 기다리는 중입니다' : '관리자 권한이 없습니다 (거절 또는 회수됨)');
    }
    return { role: me.role, name: me.name };
  }
  if (p === '/api/auth/logout') { await supa.auth.signOut(); me = null; return { ok: true }; }
  if (p === '/api/admin-requests') {
    const name = String(body.name || '').trim();
    if (name.length < 2 || name.length > 20) throw new Error('이름은 2~20자로 입력하세요');
    if (name === '슈퍼관리자') throw new Error('사용할 수 없는 이름입니다');
    ck(await supa.auth.signUp({ email: String(body.email || '').trim(), password: String(body.password || ''), options: { data: { name, note: String(body.note || '').trim().slice(0, 100) } } }));
    await supa.auth.signOut();   // 승인 전에는 로그인 상태로 두지 않는다
    return { ok: true };
  }

  // ----- 슈퍼관리자: 관리자 승인 -----
  if (p === '/api/admins') {
    const [P, A] = await Promise.all([supa.from('profiles').select('id,email,name,note,role,status,requested_at').order('requested_at'),
      supa.from('project_admins').select('admin_id,projects(name)')]);
    const profiles = ck(P), pas = ck(A);
    return { admins: profiles.filter(a => a.role !== 'super').map(a => ({ id: a.id, name: a.name, email: a.email, status: a.status, note: a.note,
      requestedAt: a.requested_at.slice(0, 19), projects: pas.filter(x => x.admin_id === a.id).map(x => x.projects?.name).filter(Boolean) })) };
  }
  if ((m = p.match(/^\/api\/admins\/([0-9a-f-]+)\/(approve|reject|revoke|delete)$/))) {
    const [, id, act] = m;
    if (act === 'delete') ck(await supa.rpc('delete_admin', { p_id: id }));
    else {
      ck(await supa.from('profiles').update({ status: act === 'approve' ? 'approved' : 'rejected' }).eq('id', id));
      if (act !== 'approve') ck(await supa.from('project_admins').delete().eq('admin_id', id));
    }
    return { ok: true };
  }

  // ----- 프로젝트 -----
  if (p === '/api/projects' && body === undefined) return { projects: await projectViews() };
  if (p === '/api/projects') {
    const name = String(body.name || '').trim().slice(0, 40);
    if (!name) throw new Error('프로젝트 이름을 입력하세요');
    ck(await supa.from('projects').insert({ name }));
    projCache.clear(); return { ok: true };
  }
  if ((m = p.match(/^\/api\/projects\/([0-9a-f-]+)\/(update|delete)$/))) {
    const [, id, act] = m;
    if (act === 'delete') ck(await supa.from('projects').delete().eq('id', id));
    else {
      const name = String(body.name || '').trim().slice(0, 40);
      if (name) ck(await supa.from('projects').update({ name }).eq('id', id));
      if (Array.isArray(body.admins)) {
        ck(await supa.from('project_admins').delete().eq('project_id', id));
        if (body.admins.length) ck(await supa.from('project_admins').insert(body.admins.map(a => ({ project_id: id, admin_id: a }))));
      }
    }
    projCache.clear(); return { ok: true };
  }
  if (p === '/api/my/projects') {
    if (!me) throw new Error('로그인이 필요합니다');
    const views = await projectViews();
    return { projects: me.role === 'super' ? views : views.filter(v => v.admins.includes(me.id)) };
  }

  // ----- 업무(주문) -----
  if (p === '/api/tasks' && body === undefined) {
    let query = supa.from('tasks').select('id,project_id,title,store,owner_name,closed,created_at,orders(count)').order('created_at', { ascending: false });
    if (q.get('project')) query = query.eq('project_id', q.get('project'));
    if (q.get('owner')) query = query.eq('owner_name', q.get('owner'));
    const rows = ck(await query);
    if (rows.some(t => !projCache.has(t.project_id))) await projectName('__refresh__');   // 새 프로젝트가 있으면 이름표 갱신
    return { tasks: rows.map(t => ({ id: t.id, title: t.title, store: t.store, projectId: t.project_id, projectName: projCache.get(t.project_id) || '(삭제된 프로젝트)',
      owner: t.owner_name, closed: t.closed, count: t.orders?.[0]?.count || 0, created: t.created_at })) };
  }
  if (p === '/api/tasks') {
    if (!me) throw new Error('로그인이 필요합니다');
    const title = String(body.title || '').trim().slice(0, 60);
    if (!title) throw new Error('업무 이름을 입력하세요');
    if (!body.projectId) throw new Error('프로젝트를 선택하세요');
    const menu = cleanMenu(body.menu);
    if (!menu.length) throw new Error('메뉴가 비어 있습니다');
    const row = ck(await supa.from('tasks').insert({ project_id: body.projectId, title, store: String(body.store || '').trim().slice(0, 40), owner_id: me.id, menu }).select('id').single());
    return { id: row.id };
  }
  if ((m = p.match(/^\/api\/tasks\/([a-z0-9]+)(?:\/(select|close|reopen|remove|delete))?$/))) {
    const [, id, act] = m;
    if (!act) return taskView(id);
    if (act === 'select') ck(await supa.rpc('select_item', { p_task: id, p_user: body.user, p_item: body.itemId ?? null, p_note: body.note || '' }));
    else if (act === 'close' || act === 'reopen') ck(await supa.from('tasks').update({ closed: act === 'close' }).eq('id', id));
    else if (act === 'remove') ck(await supa.from('orders').delete().eq('task_id', id).eq('user_name', body.user));
    else if (act === 'delete') { ck(await supa.from('tasks').delete().eq('id', id)); return { ok: true }; }
    return taskView(id);
  }

  // ----- 프랜차이즈 -----
  if (p === '/api/franchises') return { brands: (await staticBrands()).map(b => ({ id: b.id, name: b.name, url: b.url, live: !!b.live })) };
  if (p === '/api/franchise/run') { if (!me) throw new Error('로그인이 필요합니다'); return runFranchise(body.id); }

  throw new Error('지원하지 않는 요청: ' + p);
}
