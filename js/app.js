import { store, dayKey, addDays } from './store.js';
import { analyzeFood, aiAvailable, hasPersonalKey, setPersonalKey } from './ai.js';
import { I, plateLogo, handArrow } from './icons.js';

// ═════════════ Yordamchilar ═════════════
const $app = document.getElementById('app');
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}
const ico = (name, cls) => h('span', { class: cls || 'ic', html: I[name], style: { display: 'contents' } });
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const g1 = n => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DOW = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const MEAL_TYPES = { breakfast: 'Nonushta', lunch: 'Tushlik', dinner: 'Kechki', snack: 'Tamaddi' };
const typeByHour = hr => hr >= 5 && hr < 11 ? 'breakfast' : hr >= 11 && hr < 16 ? 'lunch' : hr >= 16 && hr < 22 ? 'dinner' : 'snack';
const C = { protein: 'var(--pom)', carbs: 'var(--saffron)', fat: 'var(--turq)', fiber: 'var(--sky)' };

let toastT;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

// ═════════════ Mavzu (yorug‘ / qorong‘i) ═════════════
const getTheme = () => { try { return localStorage.getItem('taom.theme') || 'auto'; } catch (e) { return 'auto'; } };
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = getTheme();
  const dark = t === 'dark' || (t === 'auto' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]').content = dark ? '#10163A' : '#1B2A6B';
}
mq.addEventListener('change', applyTheme);
applyTheme();

// ═════════════ Kaloriya me’yori ═════════════
const ACT = { '0-1': 1.2, '2-3': 1.375, '4-5': 1.55, '6+': 1.725 };
const ACT_LBL = { '0-1': '0–1 marta', '2-3': '2–3 marta', '4-5': '4–5 marta', '6+': '6 va undan ko‘p' };
const GOAL_LBL = { lose: 'Ozish', keep: 'Vaznni saqlash', gain: 'Vazn olish' };
function targets(p) {
  const w = +p.weight || 65, hgt = +p.height || 165, age = +p.age || 30;
  const bmr = 10 * w + 6.25 * hgt - 5 * age + (p.gender === 'm' ? 5 : -161);
  const tdee = bmr * (ACT[p.workouts] || 1.2);
  const factor = p.goal === 'lose' ? 0.82 : p.goal === 'gain' ? 1.12 : 1;
  const floor = p.gender === 'm' ? 1500 : 1200;
  let kcal = Math.round(Math.max(floor, tdee * factor) / 5) * 5;
  if (p.kcalManual) kcal = +p.kcalManual;
  const protein = Math.round(clamp(w * (p.goal === 'gain' ? 1.8 : 1.6), 50, 200));
  const fat = Math.round(kcal * 0.3 / 9);
  const carbs = Math.max(40, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const water = Math.round(clamp(w * 30, 1500, 3500) / 250) * 250;
  return { kcal, protein, carbs, fat, water, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

// ═════════════ Holat ═════════════
const S = { stage: null, view: 'home', sel: dayKey(), statsRange: 7, fabOpen: false, installEvt: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; });

function stageOf() {
  if (!store.ready) return 'splash';
  if (!store.user) return 'auth';
  if (store.mode === 'cloud' && store.user.provider === 'password' && !store.user.verified) return 'verify';
  if (store.mode === 'cloud' && !store.isAdmin) {
    if (!store.accessLoaded) return 'splash';
    const st = store.access ? store.access.status : 'none';
    if (st !== 'approved') return 'gate:' + st;
  }
  if (!store.profileLoaded) return 'splash';
  if (!store.profile || !store.profile.done) return 'onboard';
  return 'main';
}
function route(force) {
  const st = stageOf();
  if (st !== S.stage || force) {
    S.stage = st; closeAllSheets();
    $app.replaceChildren(
      st === 'splash' ? Splash() : st === 'auth' ? Auth() : st === 'verify' ? Verify() : st.startsWith('gate:') ? Gate(st.slice(5)) : st === 'onboard' ? Onboard() : Main()
    );
    window.scrollTo(0, 0);
  } else if (st === 'main') renderView();
}

// ═════════════ Emailni tasdiqlash (parol bilan kirganlar) ═════════════
function Verify() {
  const u = store.user;
  const check = h('button', { class: 'btn' }, 'Tasdiqladim');
  check.onclick = async () => { check.disabled = true; await store.reloadUser().catch(() => {}); if (!store.user.verified) { toast('Hali tasdiqlanmagan. Pochtangizni tekshiring'); check.disabled = false; } };
  const resend = h('button', { class: 'btn ghost' }, 'Xatni qayta yuborish');
  resend.onclick = async () => { try { await store.resendVerification(); toast('Xat qayta yuborildi'); } catch (e) { toast(authErr(e)); } };
  return h('div', { class: 'auth' },
    h('div', { class: 'auth-hero gate-hero' }, h('div', { class: 'gate-icon', html: I.mail }), h('h1', null, 'Emailni tasdiqlang'),
      h('p', null, `${u.email} manziliga xat yubordik. Undagi havolani bosing, so‘ng shu yerga qayting.`)),
    h('div', { class: 'auth-body' }, check, resend,
      h('p', { style: { color: 'var(--muted)', fontSize: '14px', textAlign: 'center', margin: '4px 0 0' } }, 'Xat kelmasa, “Spam” papkasini ham tekshiring.'),
      h('button', { class: 'link', style: { alignSelf: 'center' }, onclick: () => store.signOut() }, 'Chiqish')));
}

// ═════════════ Splash ═════════════
const Splash = () => h('div', { class: 'splash', html: plateLogo() });

// ═════════════ Kirish ═════════════
function authErr(e) {
  const c = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'Email manzili noto‘g‘ri yozilgan.',
    'auth/missing-password': 'Parolni kiriting.',
    'auth/weak-password': 'Parol kamida 8 belgidan iborat bo‘lsin.',
    'auth/email-already-in-use': 'Bu email bilan hisob allaqachon bor. “Kirish”ni tanlang.',
    'auth/invalid-credential': 'Email yoki parol noto‘g‘ri.',
    'auth/wrong-password': 'Parol noto‘g‘ri.',
    'auth/user-not-found': 'Bunday hisob topilmadi.',
    'auth/too-many-requests': 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.',
    'auth/popup-closed-by-user': 'Kirish oynasi yopildi.',
    'auth/cancelled-popup-request': 'Kirish bekor qilindi.',
    'auth/network-request-failed': 'Internet aloqasi yo‘q.',
    'auth/unauthorized-domain': 'Bu sayt Firebase’da ruxsat etilmagan. Authentication → Settings → Authorized domains bo‘limiga makhmudus.github.io ni qo‘shing.',
    'auth/operation-not-allowed': 'Bu kirish usuli Firebase’da yoqilmagan.',
    'auth/requires-recent-login': 'Xavfsizlik uchun qaytadan kiring.',
  };
  return map[c] || (e && e.message) || 'Xatolik yuz berdi.';
}

function Auth() {
  const err = h('div', { class: 'err', role: 'alert' });
  const busy = async (btn, fn) => {
    err.textContent = ''; btn.disabled = true;
    try { await fn(); } catch (e) { console.error(e); err.textContent = authErr(e); }
    finally { btn.disabled = false; }
  };

  const hero = h('div', { class: 'auth-hero' },
    h('div', { html: plateLogo() }),
    h('h1', null, 'Taom AI'),
    h('p', null, 'Ovqatingizni suratga oling — kaloriyasini sun’iy intellekt hisoblaydi.'));

  if (store.mode === 'local') {
    const name = h('input', { class: 'input', placeholder: 'Ismingiz', autocomplete: 'given-name' });
    const go = h('button', { class: 'btn', onclick: () => store.signInDemo(name.value.trim()) }, 'Boshlash');
    return h('div', { class: 'auth' }, hero, h('div', { class: 'auth-body' },
      h('div', { class: 'notice' }, 'Sinov rejimi: Firebase hali ulanmagan. Ma’lumotlar faqat shu telefonda saqlanadi, Google orqali kirish keyin yoqiladi.'),
      h('label', { class: 'field' }, h('span', null, 'Ism'), name), go));
  }

  let mode = 'login';
  const name = h('input', { class: 'input', placeholder: 'Ismingiz', autocomplete: 'name' });
  const email = h('input', { class: 'input', type: 'email', placeholder: 'email@gmail.com', autocomplete: 'email', inputmode: 'email' });
  const pass = h('input', { class: 'input', type: 'password', placeholder: 'Parol (kamida 8 belgi)', autocomplete: 'current-password' });
  const nameField = h('label', { class: 'field', hidden: true }, h('span', null, 'Ism'), name);
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Kirish');
  const toggle = h('button', { class: 'link', type: 'button' });
  const forgot = h('button', { class: 'link', type: 'button', style: { alignSelf: 'center' } }, 'Parolni unutdingizmi?');
  const sync = () => {
    nameField.hidden = mode !== 'signup';
    submit.textContent = mode === 'signup' ? 'Ro‘yxatdan o‘tish' : 'Kirish';
    toggle.textContent = mode === 'signup' ? 'Hisobingiz bormi? Kirish' : 'Hisob yo‘qmi? Ro‘yxatdan o‘tish';
    pass.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    forgot.hidden = mode === 'signup';
  };
  toggle.onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; err.textContent = ''; sync(); };
  forgot.onclick = () => busy(forgot, async () => {
    if (!email.value.trim()) throw new Error('Avval email manzilingizni yozing.');
    await store.resetPassword(email.value.trim());
    toast('Parolni tiklash havolasi emailingizga yuborildi');
  });
  const form = h('form', { onsubmit: e => {
    e.preventDefault();
    busy(submit, async () => {
      const em = email.value.trim(), pw = pass.value;
      if (mode === 'signup') {
        if (pw.length < 8) throw { code: 'auth/weak-password' };
        await store.signUpEmail(name.value.trim(), em, pw);
        toast('Tasdiqlash xati emailingizga yuborildi');
      } else await store.signInEmail(em, pw);
    });
  } }, nameField,
    h('label', { class: 'field' }, h('span', null, 'Email'), email),
    h('label', { class: 'field' }, h('span', null, 'Parol'), pass),
    err, h('div', { style: { height: '12px' } }), submit);
  sync();

  const gbtn = h('button', { class: 'btn g-btn' }, h('span', { html: I.google, style: { display: 'contents' } }), 'Google orqali kirish');
  gbtn.onclick = () => busy(gbtn, () => store.signInGoogle());

  return h('div', { class: 'auth' }, hero, h('div', { class: 'auth-body' },
    gbtn, h('div', { class: 'divider' }, 'yoki email bilan'), form,
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, toggle, forgot),
    h('div', { class: 'auth-foot' }, h('span', { class: 'ico16', html: I.shield }),
      'Parollar Google Firebase’da shifrlangan holda saqlanadi.')));
}

// ═════════════ Zayavka ekranlari ═════════════
function Gate(kind) {
  const u = store.user;
  const who = h('div', { class: 'gate-who' },
    h('div', { class: 'avatar' }, u.photo ? h('img', { src: u.photo, alt: '', referrerpolicy: 'no-referrer' }) : (u.name || u.email || '?').charAt(0).toUpperCase()),
    h('div', { style: { minWidth: 0, flex: 1 } }, h('b', null, u.name || 'Foydalanuvchi'), h('span', null, u.email)),
    h('button', { class: 'link', onclick: () => store.signOut() }, 'Chiqish'));
  const hero = (title, text, icon) => h('div', { class: 'auth-hero gate-hero' },
    h('div', { class: 'gate-icon', html: I[icon] }), h('h1', null, title), h('p', null, text));

  if (kind === 'none') {
    const name = h('input', { class: 'input', value: u.name || '', placeholder: 'Ismingiz', maxlength: 60, autocomplete: 'name' });
    const note = h('textarea', { class: 'input', placeholder: 'Masalan: Makhmudning onasiman', maxlength: 200, style: { minHeight: '84px' } });
    const err = h('div', { class: 'err', role: 'alert' });
    const btn = h('button', { class: 'btn' }, h('span', { html: I.send, style: { display: 'contents' } }), 'Zayavka yuborish');
    btn.onclick = async () => {
      err.textContent = '';
      if (!name.value.trim()) { err.textContent = 'Ismingizni yozing.'; return; }
      btn.disabled = true;
      try { const r = await store.requestAccess(name.value, note.value); if (r === 'approved') toast('Xush kelibsiz! Ruxsat berildi'); }
      catch (e) { console.error(e); err.textContent = 'Zayavka yuborilmadi. Internetni tekshirib, qayta urinib ko‘ring.'; btn.disabled = false; }
    };
    return h('div', { class: 'auth' },
      hero('Ruxsat so‘rang', 'Taom AI hozircha faqat taklif qilingan foydalanuvchilar uchun. Zayavka yuboring — admin ko‘rib chiqadi.', 'lock'),
      h('div', { class: 'auth-body' }, who,
        h('label', { class: 'field' }, h('span', null, 'Ism'), name),
        h('label', { class: 'field' }, h('span', null, 'O‘zingiz haqingizda (ixtiyoriy)'), note),
        err, btn));
  }
  if (kind === 'pending') {
    const t = store.access && store.access.requestedAt ? new Date(store.access.requestedAt) : null;
    return h('div', { class: 'auth' },
      hero('Zayavkangiz qabul qilindi', '1 daqiqadan 2 kungacha ko‘rib chiqiladi.', 'clock'),
      h('div', { class: 'auth-body' }, who,
        h('div', { class: 'card gate-card' },
          h('div', { class: 'pulse' }), h('b', null, 'Ko‘rib chiqilmoqda'),
          h('p', null, 'Ruxsat berilishi bilan ilova shu yerda o‘zi ochiladi. Ilovani yopib, keyinroq kirsangiz ham bo‘ladi.'),
          t ? h('span', null, `Yuborildi: ${t.getDate()} ${MONTHS[t.getMonth()]}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`) : null)));
  }
  if (kind === 'rejected') {
    const btn = h('button', { class: 'btn' }, 'Qayta so‘rash');
    btn.onclick = async () => { btn.disabled = true; try { await store.requestAccess(u.name, ''); } catch (e) { toast('Yuborilmadi'); btn.disabled = false; } };
    return h('div', { class: 'auth' }, hero('Zayavka rad etildi', 'Admin hozircha ruxsat bermadi. Xohlasangiz, qayta so‘rashingiz mumkin.', 'x'),
      h('div', { class: 'auth-body' }, who, btn));
  }
  return h('div', { class: 'auth' }, hero('Hisob to‘xtatilgan', 'Bu hisobga ilovadan foydalanish yopilgan. Savol bo‘lsa, admin bilan bog‘laning.', 'lock'),
    h('div', { class: 'auth-body' }, who));
}

// ═════════════ Admin panel ═════════════
function ago(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'hozirgina';
  if (m < 60) return `${m} daqiqa oldin`;
  const hh = Math.round(m / 60); if (hh < 24) return `${hh} soat oldin`;
  const d = Math.round(hh / 24); return d < 30 ? `${d} kun oldin` : new Date(ts).toLocaleDateString('ru-RU');
}
const STATUS_LBL = { pending: 'Kutilmoqda', approved: 'Ruxsat berilgan', rejected: 'Rad etilgan', blocked: 'Bloklangan' };

function Admin() {
  const R = store.requests;
  const groups = {
    pending: R.filter(r => r.status === 'pending'),
    approved: R.filter(r => r.status === 'approved'),
    other: R.filter(r => r.status === 'rejected' || r.status === 'blocked'),
  };
  if (!S.adminTab) S.adminTab = groups.pending.length ? 'pending' : 'approved';
  const act = (uid, status, msg) => store.setAccess(uid, status).then(() => toast(msg)).catch(e => toast(e.message));

  const card = r => {
    let actions;
    if (r.status === 'pending') actions = [
      h('button', { class: 'btn ghost', onclick: () => act(r.id, 'rejected', 'Rad etildi') }, 'Rad etish'),
      h('button', { class: 'btn', onclick: () => act(r.id, 'approved', 'Ruxsat berildi') }, h('span', { html: I.check, style: { display: 'contents' } }), 'Qabul qilish')];
    else if (r.status === 'approved') actions = [
      h('button', { class: 'btn ghost danger-text', onclick: async () => {
        if (await confirmSheet({ title: `${r.name || r.email} bloklansinmi?`, text: 'U ilovadan foydalana olmaydi. Ma’lumotlari o‘chmaydi, keyin qayta ochish mumkin.', ok: 'Bloklash', danger: true })) act(r.id, 'blocked', 'Bloklandi');
      } }, 'Bloklash')];
    else actions = [
      h('button', { class: 'btn ghost', onclick: async () => {
        if (await confirmSheet({ title: 'Zayavka o‘chirilsinmi?', text: 'Foydalanuvchi keyin yangidan zayavka yubora oladi.', ok: 'O‘chirish', danger: true })) store.removeAccess(r.id).catch(e => toast(e.message));
      } }, 'O‘chirish'),
      h('button', { class: 'btn', onclick: () => act(r.id, 'approved', 'Ruxsat berildi') }, 'Ruxsat berish')];
    return h('div', { class: 'card req' },
      h('div', { class: 'req-top' },
        h('div', { class: 'avatar' }, r.photo ? h('img', { src: r.photo, alt: '', referrerpolicy: 'no-referrer' }) : (r.name || r.email || '?').charAt(0).toUpperCase()),
        h('div', { class: 'req-who' }, h('b', null, r.name || 'Ismsiz'), h('span', null, r.email)),
        h('span', { class: 'req-time' }, ago(r.decidedAt && r.status !== 'pending' ? r.decidedAt : r.requestedAt))),
      r.note ? h('div', { class: 'req-note' }, r.note) : null,
      r.auto ? h('div', { class: 'req-tag' }, 'Email ro‘yxati orqali avtomatik') : null,
      r.status === 'rejected' || r.status === 'blocked' ? h('div', { class: 'req-tag' }, STATUS_LBL[r.status]) : null,
      h('div', { class: 'btn-row', style: { marginTop: '12px' } }, actions));
  };

  const list = groups[S.adminTab] || [];
  const emptyTxt = { pending: 'Yangi zayavka yo‘q.', approved: 'Hali hech kimga ruxsat berilmagan.', other: 'Rad etilgan yoki bloklangan foydalanuvchi yo‘q.' }[S.adminTab];

  const em = h('input', { class: 'input', type: 'email', placeholder: 'email@gmail.com', inputmode: 'email', autocomplete: 'off' });
  const addBtn = h('button', { class: 'round-btn', 'aria-label': 'Emailni qo‘shish', html: I.plus });
  addBtn.onclick = async () => {
    const v = em.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('Email manzilini to‘g‘ri yozing');
    addBtn.disabled = true;
    try { await store.addAllow(v); toast('Qo‘shildi'); } catch (e) { toast(e.message); addBtn.disabled = false; }
  };
  em.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

  return h('div', null,
    h('div', { class: 'page-head admin-head' },
      h('button', { class: 'round-btn', 'aria-label': 'Orqaga', html: I.back, onclick: () => { S.view = 'settings'; renderView(); window.scrollTo(0, 0); } }),
      h('div', null, h('h1', null, 'Admin panel'), h('p', null, 'Kim ilovadan foydalana oladi'))),
    h('div', { class: 'content', style: { paddingTop: '8px' } },
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('b', { style: { color: groups.pending.length ? 'var(--saffron)' : null } }, String(groups.pending.length)), h('span', null, 'yangi zayavka')),
        h('div', { class: 'kpi' }, h('b', null, String(groups.approved.length)), h('span', null, 'foydalanuvchi'))),
      h('div', { class: 'seg', style: { margin: '14px 0' } },
        [['pending', `Kutilmoqda ${groups.pending.length}`], ['approved', `Ruxsat ${groups.approved.length}`], ['other', `Rad/blok ${groups.other.length}`]]
          .map(([k, l]) => h('button', { class: S.adminTab === k ? 'on' : '', onclick: () => { S.adminTab = k; renderView(); } }, l))),
      list.length ? h('div', { class: 'meals' }, list.map(card)) : h('div', { class: 'card empty' }, h('p', null, emptyTxt)),
      h('div', { class: 'section-title' }, h('h2', null, 'Oldindan ruxsat')),
      h('div', { class: 'card' },
        h('p', { style: { margin: '0 0 12px', color: 'var(--muted)', fontSize: '14.5px' } }, 'Bu emaillar Google bilan kirishi bilan zayavkasiz ochiladi (masalan, oila a’zolari).'),
        h('div', { class: 'fix', style: { marginTop: 0 } }, em, addBtn),
        store.allowlist.length ? h('div', { style: { marginTop: '8px' } }, store.allowlist.map(a => h('div', { class: 'item', style: { alignItems: 'center' } },
          h('b', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' } }, a.email),
          h('button', { class: 'round-btn', 'aria-label': 'Ro‘yxatdan olib tashlash', html: I.trash, onclick: async () => {
            if (await confirmSheet({ title: 'Ro‘yxatdan olib tashlansinmi?', text: `${a.email} uchun avtomatik ruxsat bekor qilinadi. Allaqachon kirgan bo‘lsa, ruxsati saqlanadi.`, ok: 'Olib tashlash', danger: true })) store.removeAllow(a.id).catch(e => toast(e.message));
          } })))) : null)));
}

// ═════════════ Onboarding ═════════════
function Onboard() {
  const d = {
    name: (store.profile && store.profile.name) || (store.user.name || '').split(' ')[0] || '',
    gender: 'f', age: '', height: '', weight: '', goal: 'lose', targetWeight: '', workouts: '0-1', mealsPerDay: 3,
    ...(store.profile || {}),
  };
  const steps = ['name', 'gender', 'age', 'height', 'weight', 'goal', 'targetWeight', 'workouts', 'meals', 'result'];
  let i = 0;
  const root = h('div', { class: 'ob' });
  const visible = () => steps.filter(s => !(s === 'targetWeight' && d.goal === 'keep'));

  const opt = (key, val, label, sub, emoji) => h('button', {
    class: 'opt' + (String(d[key]) === String(val) ? ' on' : ''),
    onclick: () => { d[key] = val; next(); },
  }, emoji ? h('span', { class: 'oe' }, emoji) : null, h('span', null, label, sub ? h('small', null, sub) : null));

  const numStep = (key, title, hint, unit, min, max) => {
    const inp = h('input', { class: 'big-input', type: 'number', inputmode: 'decimal', value: d[key] || '', placeholder: '0', min, max, step: 'any' });
    const btn = h('button', { class: 'btn', onclick: () => {
      const v = parseFloat(String(inp.value).replace(',', '.'));
      if (!(v >= min && v <= max)) { toast(`${min} dan ${max} gacha son kiriting`); return; }
      d[key] = v; next();
    } }, 'Davom etish');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    setTimeout(() => inp.focus(), 250);
    return [h('h2', null, title), h('p', { class: 'hint' }, hint), h('div', { class: 'ob-body' }, inp, h('div', { class: 'big-unit' }, unit)), btn];
  };

  function draw() {
    const vs = visible(); const s = vs[i];
    let body;
    if (s === 'name') {
      const inp = h('input', { class: 'input', value: d.name, placeholder: 'Masalan, Dilnoza', autocomplete: 'given-name' });
      setTimeout(() => inp.focus(), 250);
      const btn = h('button', { class: 'btn', onclick: () => { if (!inp.value.trim()) return toast('Ismingizni yozing'); d.name = inp.value.trim().slice(0, 40); next(); } }, 'Davom etish');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
      body = [h('h2', null, 'Assalomu alaykum! Ismingiz nima?'), h('p', { class: 'hint' }, 'Bir necha savol — va kunlik kaloriya me’yoringizni hisoblab beramiz.'), h('div', { class: 'ob-body' }, inp), btn];
    } else if (s === 'gender') {
      body = [h('h2', null, 'Jinsingiz'), h('p', { class: 'hint' }, 'Kaloriya hisobi erkak va ayol uchun farq qiladi.'),
        h('div', { class: 'ob-body opts' }, opt('gender', 'f', 'Ayol', null, '👩'), opt('gender', 'm', 'Erkak', null, '👨'))];
    } else if (s === 'age') body = numStep('age', 'Yoshingiz', 'To‘liq yillar.', 'yosh', 14, 100);
    else if (s === 'height') body = numStep('height', 'Bo‘yingiz', 'Santimetrda.', 'sm', 120, 230);
    else if (s === 'weight') body = numStep('weight', 'Hozirgi vazningiz', 'Kilogrammda.', 'kg', 30, 250);
    else if (s === 'goal') {
      body = [h('h2', null, 'Maqsadingiz qanday?'), h('p', { class: 'hint' }, 'Keyin sozlamalarda o‘zgartirsa bo‘ladi.'),
        h('div', { class: 'ob-body opts' },
          opt('goal', 'lose', 'Ozish', 'Asta-sekin, sog‘likka zarar yetkazmasdan', '🌿'),
          opt('goal', 'keep', 'Vaznni saqlash', 'Hozirgi vaznda qolish', '⚖️'),
          opt('goal', 'gain', 'Vazn olish', 'Mushak va kuch uchun', '💪'))];
    } else if (s === 'targetWeight') body = numStep('targetWeight', 'Istalgan vazn', d.goal === 'lose' ? 'Qaysi vaznga erishmoqchisiz?' : 'Qancha bo‘lishini xohlaysiz?', 'kg', 30, 250);
    else if (s === 'workouts') {
      body = [h('h2', null, 'Haftada necha marta mashq qilasiz?'), h('p', { class: 'hint' }, 'Piyoda yurish, sport zali, fitnes — hammasi hisoblanadi.'),
        h('div', { class: 'ob-body opts' }, Object.entries(ACT_LBL).map(([k, v]) => opt('workouts', k, v, null, null)))];
    } else if (s === 'meals') {
      body = [h('h2', null, 'Kuniga necha marta ovqatlanasiz?'), h('p', { class: 'hint' }, 'Taxminan.'),
        h('div', { class: 'ob-body opts' }, [2, 3, 4, 5].map(n => opt('mealsPerDay', n, `${n} marta`, null, null)))];
    } else {
      const t = targets(d);
      body = [h('h2', null, `${d.name}, rejangiz tayyor`), h('p', { class: 'hint' }, 'Kunlik me’yoringiz:'),
        h('div', { class: 'ob-body' },
          h('div', { class: 'card result-plate' }, h('b', null, fmt(t.kcal)), h('span', { style: { color: 'var(--muted)', fontWeight: 700 } }, 'kkal / kun')),
          h('div', { class: 'mgrid', style: { gridTemplateColumns: 'repeat(3,1fr)', marginTop: '12px' } },
            mcell('Oqsil', t.protein, C.protein), mcell('Uglevod', t.carbs, C.carbs), mcell('Yog‘', t.fat, C.fat)),
          h('p', { class: 'hint', style: { marginTop: '18px', fontSize: '14px' } },
            'Hisob Mifflin–San Jeor formulasi asosida. Bu tibbiy maslahat emas: sog‘lig‘ingizda muammo bo‘lsa, shifokor bilan maslahatlashing.')),
        h('button', { class: 'btn', onclick: finish }, 'Boshlash')];
    }
    const prog = (i + 1) / vs.length * 100;
    root.replaceChildren(
      h('div', { class: 'ob-top' },
        i > 0 ? h('button', { class: 'round-btn', 'aria-label': 'Orqaga', onclick: () => { i--; draw(); }, html: I.back }) : h('span', { style: { width: '42px' } }),
        h('div', { class: 'ob-progress' }, h('i', { style: { width: prog + '%' } }))),
      ...body);
  }
  function next() { i = Math.min(i + 1, visible().length - 1); draw(); }
  async function finish() {
    const p = {
      name: d.name, gender: d.gender, age: +d.age, height: +d.height, weight: +d.weight,
      startWeight: +d.weight, goal: d.goal, targetWeight: d.goal === 'keep' ? +d.weight : +d.targetWeight,
      workouts: d.workouts, mealsPerDay: +d.mealsPerDay, kcalManual: null, done: true, createdAt: Date.now(),
    };
    try {
      await store.saveProfile(p);
      await store.addWeight(dayKey(), p.weight);
    } catch (e) { console.error(e); toast('Saqlab bo‘lmadi: ' + (e.message || e)); }
  }
  draw();
  return root;
}
const mcell = (label, val, color, unit = 'g') => h('div', { class: 'mcell' }, h('i', { style: { background: color } }), h('b', null, g1(val) + unit), h('span', null, label));

// ═════════════ Asosiy qobiq ═════════════
let $view, $nav;
function Main() {
  $view = h('main', { class: 'view' });
  $nav = Nav();
  renderView();
  return h('div', null, $view, $nav, FabMenu());
}

function Nav() {
  const btn = (id, icon, label) => h('button', {
    class: 'nav-btn' + (S.view === id ? ' on' : ''), 'data-v': id, 'aria-label': label,
    onclick: () => { S.view = id; S.fabOpen = false; syncFab(); renderView(); window.scrollTo(0, 0); },
  }, h('span', { html: I[icon], style: { display: 'contents' } }), h('span', null, label));
  const fab = h('button', { class: 'fab', 'aria-label': 'Ovqat qo‘shish', html: I.plus, onclick: () => { S.fabOpen = !S.fabOpen; syncFab(); } });
  return h('nav', { class: 'nav' }, h('div', { class: 'nav-inner' },
    btn('home', 'home', 'Asosiy'), btn('stats', 'chart', 'Hisobot'), h('span'), btn('weight', 'scale', 'Vazn'), btn('settings', 'settings', 'Sozlamalar'), fab));
}

function FabMenu() {
  const item = (icon, label, fn) => h('button', { class: 'fab-item', onclick: () => { S.fabOpen = false; syncFab(); fn(); } },
    h('span', { class: 'fi', html: I[icon] }), h('span', { class: 'fl' }, label));
  return [
    h('div', { class: 'fab-scrim', onclick: () => { S.fabOpen = false; syncFab(); } }),
    h('div', { class: 'fab-menu' },
      item('image', 'Galereya', () => pickImage(false)),
      item('camera', 'Kamera', () => pickImage(true)),
      item('sparkle', 'Matn', () => textAdd())),
  ];
}
function syncFab() {
  document.querySelector('.fab')?.classList.toggle('open', S.fabOpen);
  document.querySelector('.fab-scrim')?.classList.toggle('on', S.fabOpen);
  document.querySelector('.fab-menu')?.classList.toggle('on', S.fabOpen);
}

function renderView() {
  if (!$view) return;
  $nav.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('on', b.dataset.v === S.view || (S.view === 'admin' && b.dataset.v === 'settings')));
  const pend = store.isAdmin ? store.requests.filter(r => r.status === 'pending').length : 0;
  $nav.querySelector('.nav-btn[data-v=settings]').classList.toggle('has-badge', pend > 0);
  if (S.view === 'admin' && !store.isAdmin) S.view = 'settings';
  const y = window.scrollY;
  const v = S.view === 'home' ? Home() : S.view === 'stats' ? Stats() : S.view === 'weight' ? Weight() : S.view === 'admin' ? Admin() : Settings();
  $view.replaceChildren(v);
  window.scrollTo(0, y);
}

// ═════════════ Kunlik hisoblar ═════════════
function dayTotals(date) {
  const ms = store.meals.filter(m => m.date === date);
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, count: ms.length };
  ms.forEach(m => { t.kcal += m.kcal || 0; t.protein += m.protein || 0; t.carbs += m.carbs || 0; t.fat += m.fat || 0; t.fiber += m.fiber || 0; });
  return t;
}

// ═════════════ Asosiy ekran ═════════════
function Home() {
  const p = store.profile, T = targets(p), today = dayKey();
  const sel = S.sel, tot = dayTotals(sel);
  const remain = T.kcal - tot.kcal, over = remain < 0;
  const pct = clamp(tot.kcal / T.kcal, 0, 1);

  // hafta qatori: 30 kun orqaga + ertangi (faol emas)
  const daysWithMeals = new Set(store.meals.map(m => m.date));
  const week = h('div', { class: 'week', role: 'tablist', 'aria-label': 'Kunlar' });
  for (let k = -30; k <= 1; k++) {
    const key = addDays(today, k), dt = parseKey(key);
    week.append(h('button', {
      class: 'day' + (key === sel ? ' sel' : '') + (daysWithMeals.has(key) ? ' has' : ''),
      disabled: k > 0, role: 'tab', 'aria-selected': key === sel ? 'true' : 'false',
      'aria-label': `${dt.getDate()} ${MONTHS[dt.getMonth()]}`,
      onclick: () => { S.sel = key; renderView(); },
    }, h('span', { class: 'dn' }, DOW[dt.getDay()]), h('span', { class: 'dd' }, String(dt.getDate()).padStart(2, '0')), h('span', { class: 'dot' })));
  }
  requestAnimationFrame(() => {
    const selEl = week.querySelector('.sel') || week.lastChild;
    const off = selEl.offsetLeft - week.clientWidth + selEl.offsetWidth * 2 + 6;
    week.scrollLeft = Math.max(0, off);
  });

  const initials = (p.name || '?').trim().charAt(0).toUpperCase();
  const hero = h('header', { class: 'hero' },
    h('div', { class: 'topbar' },
      h('div', { class: 'brand', html: plateLogo('') + '<span>Taom AI</span>' }),
      h('button', { class: 'avatar', 'aria-label': 'Sozlamalar', onclick: () => { S.view = 'settings'; renderView(); window.scrollTo(0, 0); } },
        store.user.photo ? h('img', { src: store.user.photo, alt: '', referrerpolicy: 'no-referrer' }) : initials)),
    week,
    h('div', { class: 'plate-wrap' }, Plate(pct, over, over ? '+' + fmt(-remain) : fmt(remain), over ? 'Me’yordan ortiq' : 'Qolgan kaloriya')),
    h('div', { class: 'plate-meta' },
      h('div', null, h('b', null, fmt(tot.kcal)), 'yeyildi'),
      h('div', null, h('b', null, fmt(T.kcal)), 'me’yor')));

  const macro = (key, label, icon) => {
    const left = T[key] - tot[key];
    const w = clamp(tot[key] / T[key] * 100, 0, 100);
    return h('div', { class: 'macro' },
      h('div', { class: 'mh' }, h('span', { class: 'mi', html: I[icon], style: { color: C[key] } }),
        h('span', { class: 'mv' }, left < 0 ? '+' + g1(-left) : g1(left), h('small', null, 'g'))),
      h('div', { class: 'ml' }, left < 0 ? label + ' ortiq' : 'Qolgan ' + label.toLowerCase()),
      h('div', { class: 'bar' }, h('i', { style: { width: w + '%', background: C[key] } })));
  };

  // suv
  const water = (store.days[sel] && store.days[sel].water) || 0;
  const glasses = Math.round(T.water / 250);
  const drops = h('div', { class: 'drops' });
  for (let k = 0; k < glasses; k++) drops.append(h('i', { class: k < Math.round(water / 250) ? 'on' : '' }));
  const waterCard = h('div', { class: 'card water' },
    h('span', { html: glassSVG(clamp(water / T.water, 0, 1)), style: { display: 'contents' } }),
    h('div', { class: 'wtxt' }, h('b', null, g1(water / 1000) + ' L'), h('span', null, `Suv — me’yor ${g1(T.water / 1000)} L`), drops),
    h('button', { class: 'round-btn', 'aria-label': 'Bir stakan kamaytirish', html: I.minus, onclick: () => store.setWater(sel, water - 250).catch(e => toast(e.message)) }),
    h('button', { class: 'round-btn primary', 'aria-label': 'Bir stakan qo‘shish', html: I.plus, onclick: () => store.setWater(sel, water + 250).catch(e => toast(e.message)) }));

  const meals = store.meals.filter(m => m.date === sel);
  const list = meals.length
    ? h('div', { class: 'meals' }, meals.map(MealRow))
    : h('div', { class: 'card empty' },
        h('h3', null, sel === today ? 'Bugun hali hech narsa qo‘shilmadi' : 'Bu kunda yozuv yo‘q'),
        h('p', null, 'Ovqatni suratga oling — kaloriyasini AI hisoblab beradi.'),
        h('div', { html: handArrow }));

  const selD = parseKey(sel);
  return h('div', null, hero, h('div', { class: 'content' },
    h('div', { class: 'macros' }, macro('protein', 'Oqsil', 'protein'), macro('carbs', 'Uglevod', 'carbs'), macro('fat', 'Yog‘', 'fat')),
    waterCard,
    h('div', { class: 'section-title' },
      h('h2', null, sel === today ? 'Bugun yeganlaringiz' : `${selD.getDate()} ${MONTHS[selD.getMonth()]}`),
      meals.length ? h('span', null, `${meals.length} ta`) : null),
    list));
}

function Plate(pct, over, big, label) {
  const R = 112, L = 2 * Math.PI * R;
  const wrap = h('div', { class: 'plate' });
  wrap.innerHTML = `<svg viewBox="0 0 260 260" aria-hidden="true">
    <circle cx="130" cy="130" r="${R}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="12"/>
    <circle class="arc" cx="130" cy="130" r="${R}" fill="none" stroke="${over ? '#FF8FA3' : '#fff'}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${L}" stroke-dashoffset="${L}" transform="rotate(-90 130 130)"/>
    <circle cx="130" cy="130" r="94" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="2.6" stroke-dasharray="0 9.84" stroke-linecap="round"/>
    <circle cx="130" cy="130" r="86" fill="rgba(255,255,255,.06)"/>
  </svg>`;
  wrap.append(h('div', { class: 'center' }, h('div', { class: 'big' }, big), h('div', { class: 'lbl' + (over ? ' over' : '') }, label)));
  const arc = wrap.querySelector('.arc');
  requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = String(L * (1 - (over ? 1 : pct))); }));
  return wrap;
}

function glassSVG(f) {
  const y = 8 + (1 - f) * 40;
  return `<svg class="glass" viewBox="0 0 44 52" aria-hidden="true">
    <defs><clipPath id="gc"><path d="M6 4h32l-3.5 42a3 3 0 0 1-3 3h-19a3 3 0 0 1-3-3z"/></clipPath></defs>
    <rect x="0" y="${y}" width="44" height="52" fill="var(--sky)" opacity=".85" clip-path="url(#gc)"/>
    <path d="M6 4h32l-3.5 42a3 3 0 0 1-3 3h-19a3 3 0 0 1-3-3z" fill="none" stroke="var(--sky)" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
}

function MealRow(m) {
  const t = new Date(m.ts);
  return h('button', { class: 'meal', onclick: () => openResult({ ...m }, 'edit') },
    h('div', { class: 'thumb' }, m.photo ? h('img', { src: m.photo, alt: '', loading: 'lazy' }) : (m.emoji || '🍽️')),
    h('div', { class: 'mbody' },
      h('div', { class: 'mtop' }, h('div', { class: 'mname' }, m.name), h('span', { class: 'mtime' }, `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`)),
      h('div', { class: 'mkcal' }, h('span', { html: I.flame, style: { display: 'contents' } }), fmt(m.kcal) + ' kkal'),
      h('div', { class: 'chips' },
        h('span', null, h('i', { style: { background: C.protein } }), g1(m.protein) + 'g'),
        h('span', null, h('i', { style: { background: C.carbs } }), g1(m.carbs) + 'g'),
        h('span', null, h('i', { style: { background: C.fat } }), g1(m.fat) + 'g'))));
}

// ═════════════ Rasm tanlash va siqish ═════════════
const $file = h('input', { type: 'file', accept: 'image/*', class: 'sr', 'aria-hidden': 'true', tabindex: '-1' });
document.body.append($file);
function pickImage(camera) {
  if (camera) $file.setAttribute('capture', 'environment'); else $file.removeAttribute('capture');
  $file.value = '';
  $file.onchange = async () => {
    const f = $file.files && $file.files[0]; if (!f) return;
    try {
      const img = await loadImage(f);
      const big = toJpeg(img, 1024, 0.82);
      const thumb = toJpeg(img, 360, 0.72, true);
      runAnalysis({ image: { data: big.split(',')[1], mime: 'image/jpeg' } }, { photo: thumb, preview: big, source: 'photo' });
    } catch (e) { console.error(e); toast('Rasmni ochib bo‘lmadi'); }
  };
  $file.click();
}
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
function toJpeg(img, max, q, square) {
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}

// ═════════════ Bottom sheet ═════════════
const sheets = [];
function openSheet(content, { full = false, onClose } = {}) {
  const scrim = h('div', { class: 'sheet-scrim' });
  const body = h('div', { class: 'sbody' });
  const sh = h('div', { class: 'sheet' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'grab' }), body);
  const api = {
    el: sh, body,
    set(c) { body.replaceChildren(...[].concat(c)); },
    close() {
      sh.classList.remove('on'); scrim.classList.remove('on');
      setTimeout(() => { sh.remove(); scrim.remove(); }, 320);
      const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
      if (!sheets.length) document.body.style.overflow = '';
      onClose && onClose();
    },
  };
  scrim.onclick = () => api.close();
  api.set(content);
  document.body.append(scrim, sh);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => { sh.classList.add('on'); scrim.classList.add('on'); }));
  // pastga surib yopish
  let y0 = null;
  sh.querySelector('.grab').addEventListener('pointerdown', e => { y0 = e.clientY; sh.style.transition = 'none'; sh.setPointerCapture(e.pointerId); });
  sh.addEventListener('pointermove', e => { if (y0 == null) return; const dy = Math.max(0, e.clientY - y0); sh.style.transform = `translate(-50%, ${dy}px)`; });
  sh.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; sh.style.transition = ''; sh.style.transform = ''; if (dy > 100) api.close(); });
  sheets.push(api);
  return api;
}
function closeAllSheets() { sheets.slice().forEach(s => s.close()); }
window.addEventListener('keydown', e => { if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close(); });

function confirmSheet({ title, text, ok = 'Ha', danger = false }) {
  return new Promise(res => {
    let done = false;
    const sh = openSheet([
      h('h3', null, title), text ? h('p', { class: 'sub' }, text) : null,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; sh.close(); res(false); } }, 'Bekor qilish'),
        h('button', { class: 'btn' + (danger ? ' danger' : ''), onclick: () => { done = true; sh.close(); res(true); } }, ok)),
    ], { onClose: () => { if (!done) res(false); } });
  });
}

function editField({ title, hint, type = 'number', value, unit, min, max, options, placeholder }) {
  return new Promise(res => {
    let done = false, sh;
    const finish = v => { done = true; sh.close(); res(v); };
    let content;
    if (options) {
      content = h('div', { class: 'opts' }, options.map(([v, l, sub]) => h('button', { class: 'opt' + (String(v) === String(value) ? ' on' : ''), onclick: () => finish(v) },
        h('span', null, l, sub ? h('small', null, sub) : null))));
    } else {
      const inp = h('input', { class: 'input', type, value: value ?? '', placeholder: placeholder || '', inputmode: type === 'number' ? 'decimal' : null, step: 'any' });
      const save = () => {
        if (type === 'number') {
          const v = parseFloat(String(inp.value).replace(',', '.'));
          if (!(v >= min && v <= max)) { toast(`${min} dan ${max} gacha son kiriting`); return; }
          finish(v);
        } else finish(inp.value.trim());
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      setTimeout(() => inp.focus(), 300);
      content = [h('div', { class: 'field input-unit' }, inp, unit ? h('em', null, unit) : null), h('button', { class: 'btn', onclick: save }, 'Saqlash')];
    }
    sh = openSheet([h('h3', null, title), hint ? h('p', { class: 'sub' }, hint) : null, content], { onClose: () => { if (!done) res(undefined); } });
  });
}

// ═════════════ AI tahlili ═════════════
const PHRASES = ['Taom aniqlanmoqda', 'Porsiya o‘lchanmoqda', 'Kaloriya hisoblanmoqda', 'Oqsil, yog‘ va uglevod sanalmoqda'];

function textAdd() {
  const ta = h('textarea', { class: 'input', placeholder: 'Masalan: 1 likopcha osh, 2 bo‘lak non va ko‘k choy', maxlength: 400 });
  const ex = ['2 ta qaynatilgan tuxum va non', '1 kosa lag‘mon', '3 ta manti', 'Shakarli choy, 2 qoshiq'];
  const go = () => {
    const t = ta.value.trim(); if (t.length < 2) return toast('Nima yeganingizni yozing');
    sh.close(); runAnalysis({ text: t }, { source: 'text' });
  };
  const sh = openSheet([
    h('h3', null, 'Nima yedingiz?'),
    h('p', { class: 'sub' }, 'Oddiy so‘z bilan yozing — AI kaloriyasini hisoblaydi.'),
    h('div', { class: 'field' }, ta),
    h('div', { class: 'chipset', style: { marginBottom: '18px' } }, ex.map(e => h('button', { onclick: () => { ta.value = e; ta.focus(); } }, e))),
    h('button', { class: 'btn', onclick: go }, h('span', { html: I.sparkle, style: { display: 'contents' } }), 'Hisoblash'),
  ]);
  setTimeout(() => ta.focus(), 300);
}

function runAnalysis(input, meta) {
  if (!aiAvailable()) {
    if (store.mode === 'local' || store.isAdmin) { toast('Avval Sozlamalarda Gemini kalitini kiriting'); S.view = 'settings'; renderView(); }
    else toast('AI vaqtincha ishlamayapti. Keyinroq urinib ko‘ring.');
    return;
  }
  const photoBox = () => h('div', { class: 'res-photo' },
    meta.preview ? h('img', { src: meta.preview, alt: '' }) : h('span', null, '🍽️'),
    h('div', { class: 'veil' }), h('div', { class: 'scan' }));
  const msg = h('span', null, PHRASES[0]);
  let k = 0; const timer = setInterval(() => { k = (k + 1) % PHRASES.length; msg.textContent = PHRASES[k]; }, 1500);
  let cancelled = false;
  const sh = openSheet([photoBox(), h('div', { class: 'analyzing' }, h('b', null, 'AI tahlil qilmoqda'), msg, h('div', { class: 'dots' }, h('i'), h('i'), h('i')))],
    { full: !!meta.preview, onClose: () => { cancelled = true; clearInterval(timer); } });
  analyzeFood(input).then(r => {
    clearInterval(timer); if (cancelled) return;
    if (!r.isFood) {
      sh.set([h('div', { class: 'res-photo' }, meta.preview ? h('img', { src: meta.preview, alt: '' }) : '🤔'),
        h('h3', null, 'Ovqat topilmadi'), h('p', { class: 'sub' }, r.comment || 'Rasmda ovqat ko‘rinmadi. Taomni yaqinroqdan, yorug‘ joyda suratga oling.'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => sh.close() }, 'Yopish'),
          h('button', { class: 'btn', onclick: () => { sh.close(); meta.source === 'text' ? textAdd() : pickImage(true); } }, 'Qayta urinish'))]);
      return;
    }
    sh.close();
    const now = new Date(); const date = S.sel;
    const d = parseKey(date); d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    openResult({
      name: r.name, emoji: r.emoji, portion: r.portion, health: r.health, items: r.items, comment: r.comment,
      base: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber },
      mult: 1, photo: meta.photo || null, preview: meta.preview || null, source: meta.source,
      input: input.text || '', date, ts: d.getTime(), type: typeByHour(now.getHours()),
      ai: stripModel(r),
    }, 'new');
  }).catch(e => {
    clearInterval(timer); if (cancelled) return;
    sh.set([h('h3', null, 'Tahlil qilinmadi'), h('p', { class: 'sub' }, e.message),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => sh.close() }, 'Yopish'),
        h('button', { class: 'btn', onclick: () => { sh.close(); runAnalysis(input, meta); } }, 'Qayta urinish'))]);
  });
}

// Natija / tahrirlash oynasi
function openResult(m, mode) {
  // eski yozuvlar uchun base/mult tiklash
  if (!m.base) m.base = { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, fiber: m.fiber || 0 };
  if (!m.mult) m.mult = 1;
  let sh;
  const val = k => (m.base[k] || 0) * m.mult;
  const draw = () => sh.set(build());

  function build() {
    const name = h('input', { class: 'res-name', value: m.name, 'aria-label': 'Taom nomi', maxlength: 60, oninput: e => { m.name = e.target.value; } });
    const multOut = h('output', null, '×' + Math.round(m.mult * 100) / 100);
    const setMult = d => { m.mult = clamp(Math.round((m.mult + d) * 4) / 4, 0.25, 5); draw(); };
    const fixInp = h('input', { class: 'input', placeholder: 'Masalan: guruch emas, grechka edi', maxlength: 200 });
    const fixBtn = h('button', { class: 'round-btn', 'aria-label': 'Qayta hisoblash', html: I.send });
    fixBtn.onclick = async () => {
      const t = fixInp.value.trim(); if (!t) return toast('Nimani tuzatish kerakligini yozing');
      fixBtn.disabled = true; fixBtn.innerHTML = '<span style="font-size:13px">…</span>';
      try {
        const r = await analyzeFood({ previous: m.ai || { name: m.name, kcal: m.base.kcal, protein: m.base.protein, carbs: m.base.carbs, fat: m.base.fat, items: m.items }, correction: t });
        Object.assign(m, { name: r.name, emoji: r.emoji, portion: r.portion, health: r.health, items: r.items, comment: r.comment,
          base: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber }, mult: 1, ai: stripModel(r) });
        toast('Qayta hisoblandi'); draw();
      } catch (e) { toast(e.message); fixBtn.disabled = false; fixBtn.innerHTML = I.send; }
    };

    const save = async () => {
      const rec = {
        name: (m.name || 'Taom').trim().slice(0, 60), emoji: m.emoji || '🍽️', portion: m.portion || '',
        kcal: Math.round(val('kcal')), protein: g1n(val('protein')), carbs: g1n(val('carbs')), fat: g1n(val('fat')), fiber: g1n(val('fiber')),
        base: m.base, mult: m.mult, health: m.health || 5, items: m.items || [], comment: m.comment || '',
        type: m.type, date: m.date, ts: m.ts, photo: m.photo || null, source: m.source || 'photo', input: m.input || '',
        ai: m.ai || null,
      };
      try {
        if (mode === 'new') { await store.addMeal(rec); toast('Saqlandi'); }
        else { await store.updateMeal(m.id, rec); toast('O‘zgarishlar saqlandi'); }
        sh.close();
      } catch (e) { console.error(e); toast('Saqlab bo‘lmadi: ' + (e.message || e)); }
    };
    const del = async () => {
      if (!(await confirmSheet({ title: 'O‘chirilsinmi?', text: `“${m.name}” kundalikdan o‘chiriladi.`, ok: 'O‘chirish', danger: true }))) return;
      try { await store.deleteMeal(m.id); toast('O‘chirildi'); sh.close(); } catch (e) { toast(e.message); }
    };

    const score = m.health || 5;
    const scoreColor = score >= 7 ? 'var(--turq)' : score >= 4 ? 'var(--saffron)' : 'var(--pom)';
    const img = m.preview || m.photo;
    return [
      img ? h('div', { class: 'res-photo' }, h('img', { src: img, alt: '' })) : h('div', { class: 'res-photo', style: { height: '150px' } }, m.emoji || '🍽️'),
      h('div', { class: 'res-head' },
        h('div', { style: { flex: 1, minWidth: 0 } }, name, h('div', { class: 'res-portion' }, m.portion || '')),
        h('div', { class: 'score', title: 'Foydalilik bahosi' }, h('b', { style: { color: scoreColor } }, score + '/10'), h('span', null, 'foydalilik'))),
      h('div', { class: 'kcal-hero' },
        h('div', { class: 'flame', html: I.flame }),
        h('div', null, h('b', null, fmt(val('kcal'))), h('div', null, h('span', null, 'kilokaloriya'))),
        h('div', { class: 'stepper', 'aria-label': 'Porsiya' },
          h('button', { 'aria-label': 'Porsiyani kamaytirish', html: I.minus, onclick: () => setMult(-0.25) }), multOut,
          h('button', { 'aria-label': 'Porsiyani oshirish', html: I.plus, onclick: () => setMult(0.25) }))),
      h('div', { class: 'mgrid' }, mcell('Oqsil', val('protein'), C.protein), mcell('Uglevod', val('carbs'), C.carbs), mcell('Yog‘', val('fat'), C.fat), mcell('Kletchatka', val('fiber'), C.fiber)),
      h('div', { class: 'block-title' }, 'Ovqatlanish vaqti'),
      h('div', { class: 'seg' }, Object.entries(MEAL_TYPES).map(([k, l]) => h('button', { class: m.type === k ? 'on' : '', onclick: () => { m.type = k; draw(); } }, l))),
      m.items && m.items.length ? h('div', { class: 'items' }, h('h4', null, 'Tarkibi'),
        m.items.map(it => h('div', { class: 'item' }, h('b', { style: { fontWeight: 600 } }, it.name), h('span', null, `${it.grams ? fmt(it.grams * m.mult) + ' g · ' : ''}${fmt(it.kcal * m.mult)} kkal`)))) : null,
      m.comment ? h('div', { class: 'tip' }, h('span', { html: I.leaf, style: { display: 'contents' } }), h('div', null, m.comment)) : null,
      h('div', { class: 'block-title' }, 'Noto‘g‘ri aniqlandimi? AIga yozing'),
      h('div', { class: 'fix' }, fixInp, fixBtn),
      h('div', { style: { height: '20px' } }),
      mode === 'edit'
        ? h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', style: { flex: '0 0 64px' }, 'aria-label': 'O‘chirish', html: I.trash, onclick: del }), h('button', { class: 'btn', onclick: save }, 'Saqlash'))
        : h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => sh.close() }, 'Bekor qilish'), h('button', { class: 'btn', onclick: save }, h('span', { html: I.check, style: { display: 'contents' } }), 'Qo‘shish')),
    ];
  }
  sh = openSheet([], { full: true });
  draw();
}
const g1n = n => Math.round(n * 10) / 10;
const stripModel = ({ model, ...rest }) => rest;

// ═════════════ Hisobot ═════════════
function Stats() {
  const T = targets(store.profile), today = dayKey(), N = S.statsRange;
  const keys = []; for (let k = N - 1; k >= 0; k--) keys.push(addDays(today, -k));
  const data = keys.map(k => ({ k, ...dayTotals(k), water: (store.days[k] && store.days[k].water) || 0 }));
  const logged = data.filter(d => d.count > 0);
  const avg = f => logged.length ? logged.reduce((s, d) => s + d[f], 0) / logged.length : 0;
  const inRange = logged.filter(d => d.kcal <= T.kcal * 1.1 && d.kcal >= T.kcal * 0.7).length;
  const wDays = data.filter(d => d.water > 0);
  const avgWater = wDays.length ? wDays.reduce((s, d) => s + d.water, 0) / wDays.length : 0;

  // streak
  let streak = 0; for (let k = 0; k < 365; k++) { const key = addDays(today, -k); if (store.meals.some(m => m.date === key)) streak++; else if (k > 0) break; else continue; }

  // ustunli diagramma
  const W = 340, H = 180, pad = 22, max = Math.max(T.kcal * 1.25, ...data.map(d => d.kcal)) || 1;
  const bw = (W - pad) / N;
  const y = v => H - 20 - (v / max) * (H - 34);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kunlik kaloriya diagrammasi">`;
  data.forEach((d, i) => {
    const x = pad + i * bw + bw * 0.18, w = bw * 0.64;
    const col = d.kcal === 0 ? 'var(--surface-2)' : d.kcal > T.kcal * 1.1 ? 'var(--pom)' : 'var(--turq)';
    const top = d.kcal ? y(d.kcal) : H - 24;
    svg += `<rect x="${x}" y="${top}" width="${w}" height="${H - 20 - top}" rx="${Math.min(6, w / 2)}" fill="${col}"><title>${d.k}: ${Math.round(d.kcal)} kkal</title></rect>`;
    if (N <= 7 || i % 5 === 0 || i === N - 1) {
      const dt = parseKey(d.k);
      svg += `<text x="${x + w / 2}" y="${H - 4}" text-anchor="middle">${N <= 7 ? DOW[dt.getDay()] : dt.getDate()}</text>`;
    }
  });
  const ty = y(T.kcal);
  svg += `<line x1="${pad}" x2="${W}" y1="${ty}" y2="${ty}" stroke="var(--ink)" stroke-dasharray="4 5" stroke-width="1.5" opacity=".7"/>`;
  svg += `<text x="0" y="${ty + 4}">${Math.round(T.kcal / 100) / 10}k</text></svg>`;

  const ap = avg('protein'), ac = avg('carbs'), af = avg('fat');
  const tot = ap * 4 + ac * 4 + af * 9 || 1;

  // eng ko‘p yeyilganlar
  const from = keys[0];
  const cnt = {}; store.meals.filter(m => m.date >= from).forEach(m => { const k = m.name.trim().toLowerCase(); cnt[k] = cnt[k] || { name: m.name, n: 0, kcal: 0, emoji: m.emoji }; cnt[k].n++; cnt[k].kcal += m.kcal; });
  const top = Object.values(cnt).sort((a, b) => b.n - a.n).slice(0, 5);

  return h('div', null,
    h('div', { class: 'page-head' }, h('h1', null, 'Hisobot'), h('p', null, `Me’yor: ${fmt(T.kcal)} kkal / kun`)),
    h('div', { class: 'content', style: { paddingTop: '8px' } },
      h('div', { class: 'seg', style: { marginBottom: '14px' } },
        [[7, '7 kun'], [30, '30 kun']].map(([n, l]) => h('button', { class: S.statsRange === n ? 'on' : '', onclick: () => { S.statsRange = n; renderView(); } }, l))),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('b', null, fmt(avg('kcal'))), h('span', null, 'o‘rtacha kkal / kun')),
        h('div', { class: 'kpi' }, h('b', null, `${inRange}/${logged.length || 0}`), h('span', null, 'kun me’yorda')),
        h('div', { class: 'kpi' }, h('b', null, streak + ' kun'), h('span', null, 'ketma-ket yozib borildi')),
        h('div', { class: 'kpi' }, h('b', null, g1(avgWater / 1000) + ' L'), h('span', null, 'o‘rtacha suv'))),
      h('div', { class: 'section-title' }, h('h2', null, 'Kaloriya')),
      h('div', { class: 'card' }, h('div', { html: svg }),
        h('div', { class: 'legend' },
          h('span', null, h('i', { style: { background: 'var(--turq)' } }), 'me’yorda'),
          h('span', null, h('i', { style: { background: 'var(--pom)' } }), 'ortiqcha'),
          h('span', null, h('i', { style: { background: 'transparent', borderTop: '2px dashed var(--ink)', borderRadius: 0, height: 0 } }), 'me’yor'))),
      h('div', { class: 'section-title' }, h('h2', null, 'Makro balans')),
      h('div', { class: 'card' },
        logged.length ? [
          h('div', { class: 'stack' },
            h('i', { style: { width: ap * 4 / tot * 100 + '%', background: C.protein } }),
            h('i', { style: { width: ac * 4 / tot * 100 + '%', background: C.carbs } }),
            h('i', { style: { width: af * 9 / tot * 100 + '%', background: C.fat } })),
          h('div', { class: 'mgrid', style: { gridTemplateColumns: 'repeat(3,1fr)', marginTop: '12px' } },
            mcell(`Oqsil · ${Math.round(ap * 4 / tot * 100)}%`, ap, C.protein),
            mcell(`Uglevod · ${Math.round(ac * 4 / tot * 100)}%`, ac, C.carbs),
            mcell(`Yog‘ · ${Math.round(af * 9 / tot * 100)}%`, af, C.fat)),
          h('p', { style: { color: 'var(--muted)', fontSize: '14px', margin: '12px 2px 0' } }, `Kunlik o‘rtacha. Oqsil maqsadi: ${T.protein} g.`),
        ] : h('p', { style: { color: 'var(--muted)', margin: 0 } }, 'Hali ma’lumot yo‘q. Ovqat qo‘shsangiz, shu yerda balans ko‘rinadi.')),
      top.length ? [h('div', { class: 'section-title' }, h('h2', null, 'Ko‘p yeyilganlar')),
        h('div', { class: 'list' }, top.map(t => h('div', { class: 'row' },
          h('span', { class: 'ri', style: { fontSize: '20px' } }, t.emoji || '🍽️'),
          h('span', { class: 'rt' }, h('b', null, t.name), h('span', null, `${t.n} marta · o‘rtacha ${fmt(t.kcal / t.n)} kkal`)))))] : null));
}

// ═════════════ Vazn ═════════════
function Weight() {
  const p = store.profile;
  const ws = store.weights.length ? store.weights : [{ date: dayKey(), kg: p.weight }];
  const cur = ws[ws.length - 1].kg, start = p.startWeight || ws[0].kg, target = p.targetWeight || cur;
  const left = Math.abs(cur - target);
  const prog = start === target ? 1 : clamp((start - cur) / (start - target), 0, 1);
  const bmi = cur / ((p.height / 100) ** 2);
  const bmiLbl = bmi < 18.5 ? 'kam vazn' : bmi < 25 ? 'me’yorda' : bmi < 30 ? 'ortiqcha vazn' : 'semizlik';

  // chiziqli grafik
  const pts = ws.slice(-30);
  const W = 340, H = 170, pad = 30;
  let svg = '';
  if (pts.length >= 2) {
    const vals = pts.map(w => w.kg).concat([target]);
    const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
    const x = i => pad + i * (W - pad - 10) / (pts.length - 1);
    const y = v => 10 + (hi - v) / (hi - lo) * (H - 34);
    const d = pts.map((w, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(w.kg).toFixed(1)}`).join(' ');
    svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vazn grafigi">
      <line x1="${pad}" x2="${W - 10}" y1="${y(target)}" y2="${y(target)}" stroke="var(--turq)" stroke-dasharray="4 5" stroke-width="1.5"/>
      <text x="0" y="${y(target) + 4}">${g1(target)}</text>
      <path d="${d} L${x(pts.length - 1)} ${H - 24} L${x(0)} ${H - 24} Z" fill="var(--ink)" opacity=".08"/>
      <path d="${d}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((w, i) => `<circle cx="${x(i)}" cy="${y(w.kg)}" r="3.5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`).join('')}
      <text x="${x(0)}" y="${H - 6}" text-anchor="start">${parseKey(pts[0].date).getDate()} ${MONTHS[parseKey(pts[0].date).getMonth()].slice(0, 3)}</text>
      <text x="${x(pts.length - 1)}" y="${H - 6}" text-anchor="end">${parseKey(pts[pts.length - 1].date).getDate()} ${MONTHS[parseKey(pts[pts.length - 1].date).getMonth()].slice(0, 3)}</text>
    </svg>`;
  }

  const addW = async () => {
    const v = await editField({ title: 'Bugungi vazn', hint: 'Ertalab, nonushtadan oldin o‘lchash eng aniq.', value: cur, unit: 'kg', min: 30, max: 250 });
    if (v == null) return;
    try { await store.addWeight(dayKey(), v); await store.saveProfile({ weight: v }); toast('Vazn saqlandi'); }
    catch (e) { toast(e.message); }
  };

  return h('div', null,
    h('div', { class: 'page-head' }, h('h1', null, 'Vazn'), h('p', null, `Maqsad: ${GOAL_LBL[p.goal].toLowerCase()}${p.goal !== 'keep' ? ', ' + g1(target) + ' kg' : ''}`)),
    h('div', { class: 'content', style: { paddingTop: '8px' } },
      h('div', { class: 'card' },
        h('div', { class: 'weight-hero' }, h('b', null, g1(cur)), h('small', null, 'kg')),
        p.goal !== 'keep' ? [
          h('div', { class: 'bar', style: { height: '10px', margin: '10px 0 8px' } }, h('i', { style: { width: prog * 100 + '%', background: 'var(--turq)' } })),
          h('div', { style: { display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: '14px', fontWeight: 600 } },
            h('span', null, `Boshlanish: ${g1(start)} kg`), h('span', null, left < 0.1 ? 'Maqsadga yetdingiz!' : `Yana ${g1(left)} kg`)),
        ] : null,
        h('div', { style: { height: '14px' } }),
        h('button', { class: 'btn', onclick: addW }, h('span', { html: I.plus, style: { display: 'contents' } }), 'Vaznni kiritish')),
      h('div', { class: 'kpis', style: { marginTop: '12px' } },
        h('div', { class: 'kpi' }, h('b', null, g1(bmi)), h('span', null, `TVI — ${bmiLbl}`)),
        h('div', { class: 'kpi' }, h('b', null, fmt(targets(p).kcal)), h('span', null, 'kkal kunlik me’yor'))),
      h('div', { class: 'section-title' }, h('h2', null, 'O‘zgarish')),
      h('div', { class: 'card' }, svg ? h('div', { html: svg }) : h('p', { style: { color: 'var(--muted)', margin: 0 } }, 'Grafik uchun kamida 2 marta vazn kiriting.')),
      store.weights.length ? [h('div', { class: 'section-title' }, h('h2', null, 'Tarix')),
        h('div', { class: 'list' }, store.weights.slice(-10).reverse().map((w, i, arr) => {
          const prev = arr[i + 1]; const diff = prev ? w.kg - prev.kg : 0; const dt = parseKey(w.date);
          return h('div', { class: 'row' },
            h('span', { class: 'rt' }, h('b', null, g1(w.kg) + ' kg'), h('span', null, `${dt.getDate()} ${MONTHS[dt.getMonth()]}${prev ? ` · ${diff > 0 ? '+' : ''}${g1(diff)} kg` : ''}`)),
            h('button', { class: 'round-btn', 'aria-label': 'O‘chirish', html: I.trash, onclick: async () => {
              if (await confirmSheet({ title: 'Yozuv o‘chirilsinmi?', ok: 'O‘chirish', danger: true })) store.deleteWeight(w.id).catch(e => toast(e.message));
            } }));
        }))] : null));
}

// ═════════════ Sozlamalar ═════════════
function Settings() {
  const p = store.profile, u = store.user, T = targets(p);
  const row = (icon, title, sub, fn, cls) => h('button', { class: 'row' + (cls ? ' ' + cls : ''), onclick: fn },
    h('span', { class: 'ri', html: I[icon] }), h('span', { class: 'rt' }, h('b', null, title), sub != null ? h('span', null, sub) : null),
    fn ? h('span', { class: 'chev', html: I.chev }) : null);
  const upd = async patch => { try { await store.saveProfile(patch); toast('Saqlandi'); } catch (e) { toast(e.message); } };
  const num = (key, title, unit, min, max) => async () => {
    const v = await editField({ title, value: p[key], unit, min, max });
    if (v != null) upd({ [key]: v });
  };

  const themeNow = getTheme();
  const themeSeg = h('div', { class: 'seg', style: { margin: '4px 0' } },
    [['auto', 'Avto'], ['light', 'Yorug‘'], ['dark', 'Qorong‘i']].map(([k, l]) => h('button', { class: themeNow === k ? 'on' : '', onclick: () => { try { localStorage.setItem('taom.theme', k); } catch (e) {} applyTheme(); renderView(); } }, l)));

  const providerLbl = u.provider === 'google.com' ? 'Google hisobi' : u.provider === 'local' ? 'Sinov rejimi (faqat shu telefonda)' : u.email;
  const unverified = store.mode === 'cloud' && u.provider === 'password' && !u.verified;

  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  return h('div', null,
    h('div', { class: 'page-head' }, h('h1', null, 'Sozlamalar')),
    h('div', { class: 'content', style: { paddingTop: '8px' } },
      h('div', { class: 'card profile-card' },
        h('div', { class: 'avatar' }, u.photo ? h('img', { src: u.photo, alt: '', referrerpolicy: 'no-referrer' }) : (p.name || '?').charAt(0).toUpperCase()),
        h('div', { style: { minWidth: 0 } }, h('b', null, p.name), h('span', null, providerLbl))),
      store.isAdmin ? h('div', { class: 'list', style: { marginTop: '12px' } }, (() => {
        const n = store.requests.filter(r => r.status === 'pending').length;
        const b = row('shield', 'Admin panel', n ? `${n} ta yangi zayavka` : 'Zayavkalar va ruxsatlar', () => { S.view = 'admin'; renderView(); window.scrollTo(0, 0); });
        if (n) b.querySelector('.ri').append(h('i', { class: 'dot-badge' }));
        return b;
      })()) : null,
      unverified ? h('div', { class: 'notice', style: { marginTop: '12px' } },
        'Email manzilingiz hali tasdiqlanmagan. Pochtangizdagi havolani bosing. ',
        h('button', { class: 'link', onclick: async () => { try { await store.resendVerification(); toast('Xat qayta yuborildi'); } catch (e) { toast(authErr(e)); } } }, 'Qayta yuborish'),
        h('button', { class: 'link', onclick: async () => { await store.reloadUser(); renderView(); } }, 'Tekshirish')) : null,

      h('div', { class: 'group-title' }, 'Hisob'),
      h('div', { class: 'list' },
        row('user', 'Ism', p.name, async () => { const v = await editField({ title: 'Ism', type: 'text', value: p.name }); if (v) upd({ name: v.slice(0, 40) }); }),
        row('gift', 'Yosh', `${p.age} yosh`, num('age', 'Yosh', 'yosh', 14, 100)),
        row('user', 'Jins', p.gender === 'm' ? 'Erkak' : 'Ayol', async () => { const v = await editField({ title: 'Jins', value: p.gender, options: [['f', 'Ayol'], ['m', 'Erkak']] }); if (v) upd({ gender: v }); }),
        row('height', 'Bo‘y', `${g1(p.height)} sm`, num('height', 'Bo‘y', 'sm', 120, 230)),
        row('gauge', 'Joriy vazn', `${g1(p.weight)} kg`, async () => {
          const v = await editField({ title: 'Joriy vazn', value: p.weight, unit: 'kg', min: 30, max: 250 });
          if (v != null) { await upd({ weight: v }); store.addWeight(dayKey(), v).catch(() => {}); }
        }),
        row('bars', 'Istalgan vazn', `${g1(p.targetWeight)} kg`, num('targetWeight', 'Istalgan vazn', 'kg', 30, 250))),

      h('div', { class: 'group-title' }, 'Maqsadlar va kuzatuv'),
      h('div', { class: 'list' },
        row('fire', 'Haftalik mashqlar', ACT_LBL[p.workouts], async () => {
          const v = await editField({ title: 'Haftada necha marta mashq qilasiz?', value: p.workouts, options: Object.entries(ACT_LBL) }); if (v) upd({ workouts: v });
        }),
        row('clock', 'Kunlik ovqatlanish', `${p.mealsPerDay} marta`, async () => {
          const v = await editField({ title: 'Kuniga necha marta ovqatlanasiz?', value: p.mealsPerDay, options: [2, 3, 4, 5].map(n => [n, `${n} marta`]) }); if (v) upd({ mealsPerDay: v });
        }),
        row('flag', 'Maqsadingiz', `${GOAL_LBL[p.goal]}${p.goal !== 'keep' ? ' ' + g1(p.targetWeight) + ' kg' : ''}`, async () => {
          const v = await editField({ title: 'Maqsadingiz', value: p.goal, options: [['lose', 'Ozish'], ['keep', 'Vaznni saqlash'], ['gain', 'Vazn olish']] }); if (v) upd({ goal: v });
        }),
        row('pie', 'Kunlik kaloriya', `${fmt(T.kcal)} kkal${p.kcalManual ? ' (qo‘lda)' : ' (avtomatik)'}`, async () => {
          const v = await editField({ title: 'Kunlik kaloriya me’yori', options: [['auto', `Avtomatik — ${fmt(targets({ ...p, kcalManual: null }).kcal)} kkal`, 'Ma’lumotlaringiz asosida hisoblanadi'], ['manual', 'O‘zim kiritaman']], value: p.kcalManual ? 'manual' : 'auto' });
          if (v === 'auto') upd({ kcalManual: null });
          else if (v === 'manual') { const k = await editField({ title: 'Kunlik kaloriya', value: T.kcal, unit: 'kkal', min: 1000, max: 5000 }); if (k) upd({ kcalManual: Math.round(k) }); }
        })),

      h('div', { class: 'group-title' }, 'Ilova'),
      h('div', { class: 'list' },
        h('div', { class: 'row' }, h('span', { class: 'ri', html: I.moon }), h('span', { class: 'rt' }, h('b', null, 'Ko‘rinish'), themeSeg)),
        !isStandalone ? row('download', 'Telefonga o‘rnatish', 'Ilova sifatida bosh ekranga qo‘shish', installApp) : null,
        store.mode === 'local' || store.isAdmin ? row('key', 'Gemini kaliti', hasPersonalKey() ? 'Shaxsiy kalit ulangan' : (store.mode === 'cloud' ? 'Shart emas — Firebase orqali ishlaydi' : 'Kiritilmagan — AI uchun kerak'), keySheet) : null),

      h('div', { class: 'group-title' }, 'Ma’lumot'),
      h('div', { class: 'list' },
        row('info', 'AI qanday hisoblaydi', null, () => docSheet('ai')),
        row('doc', 'Foydalanish shartlari', null, () => docSheet('terms')),
        row('lock', 'Maxfiylik siyosati', null, () => docSheet('privacy'))),

      h('div', { class: 'group-title' }, 'Hisob amallari'),
      h('div', { class: 'list' },
        store.mode === 'cloud' && u.provider === 'password' ? row('shield', 'Parolni o‘zgartirish', null, passSheet) : null,
        row('logout', 'Chiqish', null, async () => { if (await confirmSheet({ title: 'Hisobdan chiqilsinmi?', text: 'Ma’lumotlaringiz saqlanib qoladi, qayta kirsangiz hammasi joyida bo‘ladi.', ok: 'Chiqish' })) store.signOut(); }),
        row('trash', 'Akkauntni o‘chirish', null, deleteFlow, 'danger')),
      h('p', { style: { textAlign: 'center', color: 'var(--faint)', fontSize: '13px', marginTop: '24px' } }, 'Taom AI · Gemini asosida')));
}

async function installApp() {
  if (S.installEvt) { try { S.installEvt.prompt(); await S.installEvt.userChoice; } catch (e) {} S.installEvt = null; renderView(); return; }
  openSheet([h('h3', null, 'Telefonga o‘rnatish'),
    h('div', { class: 'doc' },
      h('p', null, 'Android (Chrome): yuqori o‘ng burchakdagi ⋮ menyusini bosing → “Bosh ekranga qo‘shish” → “O‘rnatish”.'),
      h('p', null, 'Samsung Internet: pastdagi ☰ menyu → “Sahifani qo‘shish” → “Bosh ekran”.'),
      h('p', null, 'iPhone (Safari): “Ulashish” tugmasi → “Bosh ekranga qo‘shish”.')),
    h('button', { class: 'btn', onclick: closeAllSheets }, 'Tushunarli')]);
}

function keySheet() {
  const inp = h('input', { class: 'input', type: 'password', placeholder: 'AIza…', value: '', autocomplete: 'off' });
  const sh = openSheet([
    h('h3', null, 'Gemini kaliti'),
    h('p', { class: 'sub' }, store.mode === 'cloud'
      ? 'Ilova Firebase orqali AI’dan bepul foydalanadi, kalit shart emas. Agar bepul limit tugab qolsa, o‘zingizning kalitingizni qo‘shishingiz mumkin.'
      : 'AI ishlashi uchun bepul kalit kerak. aistudio.google.com/apikey saytiga Google hisobingiz bilan kiring → “Create API key” → kalitni nusxalab shu yerga qo‘ying.'),
    h('div', { class: 'notice', style: { marginBottom: '14px' } }, 'Kalit faqat shu telefonda saqlanadi va hech kimga yuborilmaydi (faqat Google’ga).'),
    h('div', { class: 'field' }, inp),
    h('div', { class: 'btn-row' },
      hasPersonalKey() ? h('button', { class: 'btn ghost', onclick: () => { setPersonalKey(''); toast('Kalit o‘chirildi'); sh.close(); renderView(); } }, 'O‘chirish') : null,
      h('button', { class: 'btn', onclick: () => {
        const k = inp.value.trim(); if (!/^AIza[\w-]{20,}$/.test(k)) return toast('Kalit “AIza” bilan boshlanishi kerak');
        setPersonalKey(k); toast('Kalit saqlandi'); sh.close(); renderView();
      } }, 'Saqlash')),
  ]);
}

function passSheet() {
  const cur = h('input', { class: 'input', type: 'password', placeholder: 'Joriy parol', autocomplete: 'current-password' });
  const nw = h('input', { class: 'input', type: 'password', placeholder: 'Yangi parol (kamida 8 belgi)', autocomplete: 'new-password' });
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn' }, 'Parolni o‘zgartirish');
  const sh = openSheet([h('h3', null, 'Parolni o‘zgartirish'), h('div', { class: 'field' }, cur), h('div', { class: 'field' }, nw), err, h('div', { style: { height: '10px' } }), btn]);
  btn.onclick = async () => {
    err.textContent = '';
    if (nw.value.length < 8) { err.textContent = 'Yangi parol kamida 8 belgi bo‘lsin.'; return; }
    btn.disabled = true;
    try { await store.changePassword(cur.value, nw.value); toast('Parol o‘zgartirildi'); sh.close(); }
    catch (e) { err.textContent = authErr(e); btn.disabled = false; }
  };
}

async function deleteFlow() {
  const ok = await confirmSheet({ title: 'Akkaunt o‘chirilsinmi?', text: 'Barcha ovqatlar, vazn tarixi va profilingiz butunlay o‘chiriladi. Buni qaytarib bo‘lmaydi.', ok: 'Davom etish', danger: true });
  if (!ok) return;
  let password;
  if (store.mode === 'cloud' && store.user.provider === 'password') {
    password = await editField({ title: 'Parolni kiriting', hint: 'Xavfsizlik uchun parolingizni tasdiqlang.', type: 'password' });
    if (!password) return;
  }
  try { await store.deleteAccount(password); toast('Akkaunt o‘chirildi'); }
  catch (e) { console.error(e); toast(authErr(e)); }
}

function docSheet(kind) {
  const D = {
    ai: ['AI qanday hisoblaydi', [
      ['Qanday ishlaydi', 'Siz yuborgan rasm yoki matn Google’ning Gemini modeliga yuboriladi. Model taomni, porsiyani va tarkibini aniqlab, kaloriya hamda oqsil, yog‘, uglevod miqdorini taxmin qiladi.'],
      ['Aniqlik', 'Natija taxminiy: rasmdan yog‘ va shakar miqdorini aniq bilish qiyin. Osh, sho‘rva kabi taomlarda farq 15–25% bo‘lishi mumkin. Noto‘g‘ri bo‘lsa, “AIga yozing” maydoni orqali tuzating yoki porsiyani o‘zgartiring.'],
      ['Kunlik me’yor', 'Mifflin–San Jeor formulasi va faollik darajasi asosida hisoblanadi. Ozish uchun taxminan 18% kam, lekin ayollar uchun 1200, erkaklar uchun 1500 kkaldan past emas.'],
    ]],
    terms: ['Foydalanish shartlari', [
      ['Bepul', 'Taom AI shaxsiy foydalanish uchun bepul ilova.'],
      ['Tibbiy maslahat emas', 'Ilova ma’lumotlari faqat yo‘l-yo‘riq uchun. Kasallik, homiladorlik yoki maxsus parhezda bo‘lsangiz, shifokor bilan maslahatlashing.'],
      ['Mas’uliyat', 'Kaloriya hisoblari AI tomonidan taxmin qilinadi va xato bo‘lishi mumkin.'],
    ]],
    privacy: ['Maxfiylik siyosati', [
      ['Nima saqlanadi', 'Profilingiz (ism, yosh, bo‘y, vazn, maqsad), ovqat yozuvlari, kichik rasm nusxalari, suv va vazn tarixi.'],
      ['Qayerda', store.mode === 'cloud' ? 'Google Firebase serverlarida, faqat sizning hisobingizga bog‘langan. Xavfsizlik qoidalari tufayli boshqa foydalanuvchi ma’lumotlaringizni ko‘ra olmaydi.' : 'Faqat shu telefonda (sinov rejimi).'],
      ['AI', 'Rasm va matn tahlil uchun Google Gemini’ga yuboriladi. Bepul tarifda Google bu ma’lumotlardan o‘z xizmatlarini yaxshilash uchun foydalanishi mumkin, shuning uchun rasmga shaxsiy narsalarni tushirmang.'],
      ['O‘chirish', 'Sozlamalar → “Akkauntni o‘chirish” barcha ma’lumotlarni butunlay o‘chiradi.'],
      ['Himoya', 'Ilova Google reCAPTCHA bilan himoyalangan: Google’ning Maxfiylik siyosati (policies.google.com/privacy) va Foydalanish shartlari (policies.google.com/terms) amal qiladi.'],
    ]],
  }[kind];
  openSheet([h('h3', null, D[0]), h('div', { class: 'doc' }, D[1].map(([t, x]) => [h('h4', null, t), h('p', null, x)])),
    h('div', { style: { height: '10px' } }), h('button', { class: 'btn ghost', onclick: closeAllSheets }, 'Yopish')]);
}

// ═════════════ Ishga tushirish ═════════════
store.onChange(() => route());
route();
store.init().then(() => route()).catch(e => {
  console.error(e);
  $app.replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'auth-hero' }, h('div', { html: plateLogo() }), h('h1', null, 'Taom AI')),
    h('div', { class: 'auth-body' }, h('div', { class: 'notice' }, 'Ilovani yuklab bo‘lmadi. Internet aloqasini tekshiring.'),
      h('button', { class: 'btn', onclick: () => location.reload() }, 'Qayta yuklash'))));
});
// sana o‘zgarsa (yarim tun), bugungi kunga o‘tish
let lastDay = dayKey();
setInterval(() => { const d = dayKey(); if (d !== lastDay) { if (S.sel === lastDay) S.sel = d; lastDay = d; route(); } }, 60000);
