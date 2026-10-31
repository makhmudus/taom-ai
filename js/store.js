// Ma’lumotlar qatlami: Firebase (Auth + Firestore) yoki sinov rejimi (localStorage).
import { firebaseConfig, FIREBASE_VERSION, ADMIN_EMAILS, APPCHECK_SITE_KEY } from './config.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
const WINDOW_DAYS = 120; // shuncha kunlik ovqat va suv tarixi jonli sinxronlanadi

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};
// Login (pochtasiz) → ichki email. Bu domen hech qachon xat olmaydi.
export const LOGIN_DOMAIN = 'taom.example.com';
export const toEmail = v => { v = String(v || '').trim().toLowerCase(); return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`; };
export const showLogin = e => String(e || '').replace('@' + LOGIN_DOMAIN, '');
const clean = o => JSON.parse(JSON.stringify(o));
const uid6 = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

export const store = {
  mode: firebaseConfig ? 'cloud' : 'local',
  ready: false,
  user: null,          // {uid, email, name, photo, provider, verified}
  profile: null,       // null = hali to‘ldirilmagan
  profileLoaded: false,
  meals: [],           // so‘nggi WINDOW_DAYS kun
  days: {},            // {date: {water}}
  weights: [],         // [{id, date, kg}]
  access: null,        // {status: pending|approved|rejected|blocked, ...}
  accessLoaded: false,
  isAdmin: false,
  requests: [],        // admin uchun: barcha zayavkalar
  allowlist: [],       // admin uchun: oldindan ruxsat berilgan emaillar
  _listeners: new Set(),
  _unsubs: [],
  _dataUnsubs: [],
  _dataOn: false,
  fb: null,

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  emit(what) { this._listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } }); },

  async init() {
    if (this.mode === 'cloud') await this._initCloud();
    else this._initLocal();
    this.ready = true;
  },

  // ───────────── Firebase ─────────────
  async _initCloud() {
    const [appM, authM, fsM] = await Promise.all([
      import(CDN + 'firebase-app.js'),
      import(CDN + 'firebase-auth.js'),
      import(CDN + 'firebase-firestore.js'),
    ]);
    const app = appM.initializeApp(firebaseConfig);
    // App Check boshqa xizmatlardan OLDIN yoqiladi
    if (APPCHECK_SITE_KEY) {
      try {
        const ac = await import(CDN + 'firebase-app-check.js');
        ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
      } catch (e) { console.error('App Check', e); }
    }
    const auth = authM.getAuth(app);
    auth.languageCode = 'uz';
    let db;
    try {
      db = fsM.initializeFirestore(app, {
        localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
      });
    } catch (e) { db = fsM.getFirestore(app); }
    this.fb = { app, auth, db, A: authM, F: fsM, appM };

    await new Promise(resolve => {
      let first = true;
      authM.onAuthStateChanged(auth, u => {
        this._detach();
        if (u) {
          this.user = this._mapUser(u);
          this.isAdmin = !!(u.email && u.emailVerified && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(u.email.toLowerCase()));
          this._attachCloud(u.uid);
        } else {
          this.user = null; this.profile = null; this.profileLoaded = true; this.isAdmin = false;
          this.access = null; this.accessLoaded = true; this.requests = []; this.allowlist = [];
          this.meals = []; this.days = {}; this.weights = [];
        }
        this.emit('auth');
        if (first) { first = false; resolve(); }
      });
    });
  },

  _mapUser(u) {
    return {
      uid: u.uid, email: u.email, name: u.displayName || '', photo: u.photoURL || '',
      provider: (u.providerData[0] && u.providerData[0].providerId) || 'password',
      verified: u.emailVerified,
    };
  },

  _detach() { this._detachData(); this._unsubs.forEach(f => { try { f(); } catch (e) {} }); this._unsubs = []; },
  _detachData() {
    this._dataUnsubs.forEach(f => { try { f(); } catch (e) {} }); this._dataUnsubs = []; this._dataOn = false;
    this.profile = null; this.meals = []; this.days = {}; this.weights = [];
  },

  // Avval ruxsat (access) tekshiriladi, faqat ruxsat bo‘lsa ma’lumotlarga ulanadi
  _attachCloud(uid) {
    const { db, F } = this.fb;
    this.access = null; this.accessLoaded = false; this.profileLoaded = false;
    if (this.isAdmin) {
      this.access = { status: 'approved' }; this.accessLoaded = true;
      this._attachData(uid); this._attachAdmin(); return;
    }
    let autoTried = false;
    this._unsubs.push(F.onSnapshot(F.doc(db, 'access', uid), async s => {
      // Email oldindan ruxsat ro‘yxatida bo‘lsa — zayavkasiz darhol ochiladi
      if (!s.exists() && !autoTried && this.fb.auth.currentUser && this.fb.auth.currentUser.emailVerified) {
        autoTried = true;
        if (await this._tryAutoApprove()) return; // keyingi snapshot "approved" bilan keladi
      }
      this.access = s.exists() ? s.data() : null;
      this.accessLoaded = true;
      if (this.access && this.access.status === 'approved') { if (!this._dataOn) this._attachData(uid); }
      else if (this._dataOn) this._detachData();
      this.emit('access');
    }, err => { console.error(err); this.accessLoaded = true; this.emit('access'); }));
  },

  _attachAdmin() {
    const { db, F } = this.fb;
    this._unsubs.push(F.onSnapshot(F.collection(db, 'access'), s => {
      this.requests = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
      this.emit('requests');
    }, err => console.error(err)));
    this._unsubs.push(F.onSnapshot(F.collection(db, 'allowlist'), s => {
      this.allowlist = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
      this.emit('allowlist');
    }, err => console.error(err)));
  },

  _attachData(uid) {
    const { db, F } = this.fb;
    this._dataOn = true;
    this.profileLoaded = false;
    const push = f => this._dataUnsubs.push(f);
    const from = addDays(dayKey(), -WINDOW_DAYS);
    const userRef = F.doc(db, 'users', uid);
    push(F.onSnapshot(userRef, s => {
      this.profile = s.exists() ? s.data() : null;
      this.profileLoaded = true;
      this.emit('profile');
    }, err => { console.error(err); this.profileLoaded = true; this.emit('error'); }));

    const mq = F.query(F.collection(db, 'users', uid, 'meals'), F.where('date', '>=', from), F.orderBy('date', 'desc'));
    push(F.onSnapshot(mq, s => {
      this.meals = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts);
      this.emit('meals');
    }, err => console.error(err)));

    const dq = F.query(F.collection(db, 'users', uid, 'days'), F.where('date', '>=', from));
    push(F.onSnapshot(dq, s => {
      const o = {}; s.docs.forEach(d => { o[d.id] = d.data(); }); this.days = o; this.emit('days');
    }, err => console.error(err)));

    const wq = F.query(F.collection(db, 'users', uid, 'weights'), F.orderBy('date', 'asc'));
    push(F.onSnapshot(wq, s => {
      this.weights = s.docs.map(d => ({ id: d.id, ...d.data() })); this.emit('weights');
    }, err => console.error(err)));
  },

  // ───────────── Sinov rejimi ─────────────
  _initLocal() {
    try { this._local = JSON.parse(localStorage.getItem('taom.local') || 'null'); } catch (e) { this._local = null; }
    if (this._local && this._local.user) this._loadLocal();
    else { this.user = null; this.profileLoaded = true; }
  },
  _loadLocal() {
    const L = this._local;
    this.user = L.user; this.profile = L.profile || null; this.profileLoaded = true;
    this.access = { status: 'approved' }; this.accessLoaded = true;
    this.meals = (L.meals || []).slice().sort((a, b) => b.ts - a.ts);
    this.days = L.days || {}; this.weights = (L.weights || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  },
  _saveLocal() {
    const L = this._local;
    L.profile = this.profile; L.meals = this.meals; L.days = this.days; L.weights = this.weights;
    try { localStorage.setItem('taom.local', JSON.stringify(L)); }
    catch (e) { throw new Error('Telefon xotirasida joy qolmadi. Eski ovqat rasmlarini o‘chirib ko‘ring.'); }
  },

  // ───────────── Kirish / chiqish ─────────────
  async signInGoogle() {
    const { auth, A } = this.fb;
    const p = new A.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    try { await A.signInWithPopup(auth, p); }
    catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await A.signInWithRedirect(auth, p);
      } else throw e;
    }
  },
  async signInEmail(email, pass) {
    const { auth, A } = this.fb;
    await A.signInWithEmailAndPassword(auth, toEmail(email), pass);
  },
  async signUpEmail(name, email, pass) {
    const { auth, A } = this.fb;
    email = toEmail(email);
    const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
    if (name) await A.updateProfile(cred.user, { displayName: name });
    if (!email.endsWith('@' + LOGIN_DOMAIN)) { try { await A.sendEmailVerification(cred.user); } catch (e) {} }
    this.user = this._mapUser(cred.user); this.emit('auth');
  },
  async resetPassword(email) {
    const { auth, A } = this.fb;
    await A.sendPasswordResetEmail(auth, email);
  },
  async resendVerification() {
    const { auth, A } = this.fb;
    if (auth.currentUser) await A.sendEmailVerification(auth.currentUser);
  },
  async reloadUser() {
    if (this.mode !== 'cloud') return;
    const { auth } = this.fb;
    if (auth.currentUser) { await auth.currentUser.reload(); this.user = this._mapUser(auth.currentUser); this.emit('auth'); }
  },
  signInDemo(name) {
    this._local = { user: { uid: 'local', email: '', name: name || 'Mehmon', photo: '', provider: 'local', verified: true } };
    this._saveLocalSafe(); this._loadLocal(); this.emit('auth');
  },
  _saveLocalSafe() { try { localStorage.setItem('taom.local', JSON.stringify(this._local)); } catch (e) {} },

  async signOut() {
    if (this.mode === 'cloud') { const { auth, A } = this.fb; await A.signOut(auth); }
    else { this.user = null; this.emit('auth'); }
  },

  async changePassword(current, next) {
    const { auth, A } = this.fb;
    const u = auth.currentUser;
    const cred = A.EmailAuthProvider.credential(u.email, current);
    await A.reauthenticateWithCredential(u, cred);
    await A.updatePassword(u, next);
  },

  // password — faqat email bilan kirganlar uchun
  async deleteAccount(password) {
    if (this.mode === 'local') {
      localStorage.removeItem('taom.local'); this._local = null;
      this.user = null; this.profile = null; this.meals = []; this.days = {}; this.weights = [];
      this.emit('auth'); return;
    }
    const { auth, db, A, F } = this.fb;
    const u = auth.currentUser;
    // Avval qayta tasdiqlash (xavfsizlik)
    if (this.user.provider === 'google.com') await A.reauthenticateWithPopup(u, new A.GoogleAuthProvider());
    else await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, password));
    this._detach();
    for (const col of ['meals', 'days', 'weights']) {
      const snap = await F.getDocs(F.collection(db, 'users', u.uid, col));
      let batch = F.writeBatch(db), n = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref); n++;
        if (n === 400) { await batch.commit(); batch = F.writeBatch(db); n = 0; }
      }
      if (n) await batch.commit();
    }
    await F.deleteDoc(F.doc(db, 'users', u.uid));
    try { await F.deleteDoc(F.doc(db, 'access', u.uid)); } catch (e) {}
    await A.deleteUser(u);
  },

  // ───────────── Ruxsat (zayavka) ─────────────
  async requestAccess(name, note) {
    const { db, F, auth } = this.fb;
    const u = auth.currentUser;
    const ref = F.doc(db, 'access', u.uid);
    const now = Date.now();
    note = String(note || '').trim().slice(0, 200);
    if (this.access && this.access.status === 'rejected') {
      await F.updateDoc(ref, { status: 'pending', note, requestedAt: now }); return 'pending';
    }
    const base = {
      uid: u.uid, email: (u.email || '').toLowerCase(), name: String(name || u.displayName || '').trim().slice(0, 60),
      photo: u.photoURL || '', note, requestedAt: now,
    };
    // Email oldindan ruxsat ro‘yxatida bo‘lsa — darhol ochiladi (Firestore qoidasi tekshiradi)
    if (u.emailVerified) {
      try { await F.setDoc(ref, { ...base, status: 'approved', auto: true }); return 'approved'; }
      catch (e) { /* ro‘yxatda yo‘q — oddiy zayavka */ }
    }
    await F.setDoc(ref, { ...base, status: 'pending' });
    return 'pending';
  },
  async _tryAutoApprove() {
    const { db, F, auth } = this.fb;
    const u = auth.currentUser;
    try {
      await F.setDoc(F.doc(db, 'access', u.uid), {
        uid: u.uid, email: (u.email || '').toLowerCase(), name: String(u.displayName || '').slice(0, 60),
        photo: u.photoURL || '', note: '', requestedAt: Date.now(), status: 'approved', auto: true,
      });
      return true;
    } catch (e) { return false; }
  },
  // admin: login va parol bilan yangi foydalanuvchi yaratish (admin hisobidan chiqmasdan)
  async createManagedUser(name, login, password) {
    const { appM, A, F, db } = this.fb;
    const email = toEmail(login);
    const tmp = appM.initializeApp(firebaseConfig, 'create-' + Date.now());
    try {
      const a2 = A.initializeAuth(tmp, { persistence: A.inMemoryPersistence });
      const cred = await A.createUserWithEmailAndPassword(a2, email, password);
      if (name) await A.updateProfile(cred.user, { displayName: name });
      const uid = cred.user.uid;
      await A.signOut(a2);
      const now = Date.now();
      await F.setDoc(F.doc(db, 'access', uid), {
        uid, email, name: String(name || '').slice(0, 60), photo: '', note: 'Admin qo‘shgan',
        status: 'approved', requestedAt: now, decidedAt: now, managed: true, login: showLogin(email),
      });
      // Admin keyin qayta ko‘rishi uchun (faqat admin o‘qiy oladi)
      try { await F.setDoc(F.doc(db, 'creds', uid), { login: showLogin(email), password, createdAt: now }); } catch (e) { console.warn('creds', e); }
      return { uid, login: showLogin(email) };
    } finally {
      try { await appM.deleteApp(tmp); } catch (e) {}
    }
  },
  // admin: foydalanuvchi ma’lumotlarini ko‘rish
  async adminLoadUser(uid, date) {
    const { F, db } = this.fb;
    const safe = p => p.catch(e => { console.warn(e); return null; });
    const [prof, meals, day, cred] = await Promise.all([
      safe(F.getDoc(F.doc(db, 'users', uid))),
      safe(F.getDocs(F.query(F.collection(db, 'users', uid, 'meals'), F.where('date', '==', date)))),
      safe(F.getDoc(F.doc(db, 'users', uid, 'days', date))),
      safe(F.getDoc(F.doc(db, 'creds', uid))),
    ]);
    return {
      profile: prof && prof.exists() ? prof.data() : null,
      meals: meals ? meals.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.ts - b.ts) : [],
      water: day && day.exists() ? (day.data().water || 0) : 0,
      creds: cred && cred.exists() ? cred.data() : null,
      denied: !prof && !meals,
    };
  },
  // admin
  async setAccess(uid, status) {
    const { db, F } = this.fb;
    await F.updateDoc(F.doc(db, 'access', uid), { status, decidedAt: Date.now() });
  },
  async removeAccess(uid) {
    const { db, F } = this.fb;
    await F.deleteDoc(F.doc(db, 'access', uid));
  },
  async addAllow(email) {
    const { db, F } = this.fb;
    email = email.trim().toLowerCase();
    await F.setDoc(F.doc(db, 'allowlist', email), { email, addedAt: Date.now() });
    // shu email bilan kutayotgan zayavka bo‘lsa — qabul qilinadi
    const waiting = this.requests.filter(r => r.email === email && r.status !== 'approved');
    for (const r of waiting) await this.setAccess(r.id, 'approved');
  },
  async removeAllow(email) {
    const { db, F } = this.fb;
    await F.deleteDoc(F.doc(db, 'allowlist', email));
  },

  // ───────────── Profil ─────────────
  async saveProfile(patch) {
    const next = { ...(this.profile || {}), ...patch, updatedAt: Date.now() };
    if (this.mode === 'local') { this.profile = next; this._saveLocal(); this.emit('profile'); return; }
    const { db, F } = this.fb;
    this.profile = next; this.emit('profile');
    await F.setDoc(F.doc(db, 'users', this.user.uid), clean(next), { merge: true });
  },

  // ───────────── Ovqatlar ─────────────
  async addMeal(meal) {
    const m = { ...meal, id: meal.id || uid6(), createdAt: Date.now() };
    if (this.mode === 'local') {
      this.meals = [m, ...this.meals].sort((a, b) => b.ts - a.ts); this._saveLocal(); this.emit('meals'); return m;
    }
    const { db, F } = this.fb;
    const { id, ...data } = m;
    await F.setDoc(F.doc(db, 'users', this.user.uid, 'meals', id), clean(data));
    return m;
  },
  async updateMeal(id, patch) {
    if (this.mode === 'local') {
      this.meals = this.meals.map(m => m.id === id ? { ...m, ...patch } : m).sort((a, b) => b.ts - a.ts);
      this._saveLocal(); this.emit('meals'); return;
    }
    const { db, F } = this.fb;
    await F.updateDoc(F.doc(db, 'users', this.user.uid, 'meals', id), clean(patch));
  },
  async deleteMeal(id) {
    if (this.mode === 'local') { this.meals = this.meals.filter(m => m.id !== id); this._saveLocal(); this.emit('meals'); return; }
    const { db, F } = this.fb;
    await F.deleteDoc(F.doc(db, 'users', this.user.uid, 'meals', id));
  },

  // ───────────── Suv ─────────────
  async setWater(date, ml) {
    ml = Math.max(0, Math.min(6000, Math.round(ml)));
    this.days = { ...this.days, [date]: { ...(this.days[date] || {}), date, water: ml } };
    if (this.mode === 'local') { this._saveLocal(); this.emit('days'); return; }
    this.emit('days');
    const { db, F } = this.fb;
    await F.setDoc(F.doc(db, 'users', this.user.uid, 'days', date), { date, water: ml }, { merge: true });
  },

  // ───────────── Vazn ─────────────
  async addWeight(date, kg) {
    const rec = { date, kg: Math.round(kg * 10) / 10, ts: Date.now() };
    if (this.mode === 'local') {
      this.weights = [...this.weights.filter(w => w.date !== date), { id: date, ...rec }].sort((a, b) => a.date < b.date ? -1 : 1);
      this._saveLocal(); this.emit('weights'); return;
    }
    const { db, F } = this.fb;
    await F.setDoc(F.doc(db, 'users', this.user.uid, 'weights', date), rec);
  },
  async deleteWeight(id) {
    if (this.mode === 'local') { this.weights = this.weights.filter(w => w.id !== id); this._saveLocal(); this.emit('weights'); return; }
    const { db, F } = this.fb;
    await F.deleteDoc(F.doc(db, 'users', this.user.uid, 'weights', id));
  },
};
