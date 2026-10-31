// Ma’lumotlar qatlami: Firebase (Auth + Firestore) yoki sinov rejimi (localStorage).
import { firebaseConfig, FIREBASE_VERSION } from './config.js';

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
  _listeners: new Set(),
  _unsubs: [],
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
    const auth = authM.getAuth(app);
    auth.languageCode = 'uz';
    let db;
    try {
      db = fsM.initializeFirestore(app, {
        localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
      });
    } catch (e) { db = fsM.getFirestore(app); }
    this.fb = { app, auth, db, A: authM, F: fsM };

    await new Promise(resolve => {
      let first = true;
      authM.onAuthStateChanged(auth, u => {
        this._detach();
        if (u) {
          this.user = this._mapUser(u);
          this._attachCloud(u.uid);
        } else {
          this.user = null; this.profile = null; this.profileLoaded = true;
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

  _detach() { this._unsubs.forEach(f => { try { f(); } catch (e) {} }); this._unsubs = []; },

  _attachCloud(uid) {
    const { db, F } = this.fb;
    this.profileLoaded = false;
    const from = addDays(dayKey(), -WINDOW_DAYS);
    const userRef = F.doc(db, 'users', uid);
    this._unsubs.push(F.onSnapshot(userRef, s => {
      this.profile = s.exists() ? s.data() : null;
      this.profileLoaded = true;
      this.emit('profile');
    }, err => { console.error(err); this.profileLoaded = true; this.emit('error'); }));

    const mq = F.query(F.collection(db, 'users', uid, 'meals'), F.where('date', '>=', from), F.orderBy('date', 'desc'));
    this._unsubs.push(F.onSnapshot(mq, s => {
      this.meals = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.ts - a.ts);
      this.emit('meals');
    }, err => console.error(err)));

    const dq = F.query(F.collection(db, 'users', uid, 'days'), F.where('date', '>=', from));
    this._unsubs.push(F.onSnapshot(dq, s => {
      const o = {}; s.docs.forEach(d => { o[d.id] = d.data(); }); this.days = o; this.emit('days');
    }, err => console.error(err)));

    const wq = F.query(F.collection(db, 'users', uid, 'weights'), F.orderBy('date', 'asc'));
    this._unsubs.push(F.onSnapshot(wq, s => {
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
    await A.signInWithEmailAndPassword(auth, email, pass);
  },
  async signUpEmail(name, email, pass) {
    const { auth, A } = this.fb;
    const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
    if (name) await A.updateProfile(cred.user, { displayName: name });
    try { await A.sendEmailVerification(cred.user); } catch (e) {}
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
    await A.deleteUser(u);
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
