// ─────────────────────────────────────────────────────────────
//  Taom AI — sozlamalar
// ─────────────────────────────────────────────────────────────
//
// 1) Firebase konsolidan (console.firebase.google.com) olingan
//    "firebaseConfig" obyektini shu yerga qo‘ying.
//    Bu ma’lumot sir emas: xavfsizlikni Firestore qoidalari
//    (firestore.rules) va Firebase Auth ta’minlaydi.
//
// 2) Agar null qolsa, ilova "sinov rejimi"da ishlaydi:
//    ma’lumotlar faqat shu telefonda saqlanadi, AI uchun esa
//    Sozlamalarda shaxsiy Gemini kaliti kiritiladi.

export const firebaseConfig = {
  apiKey: "AIzaSyCjgdTXIU6KHANvEZMaikQxBShDPrKrJfs",
  authDomain: "taom-ai-852bd.firebaseapp.com",
  projectId: "taom-ai-852bd",
  storageBucket: "taom-ai-852bd.firebasestorage.app",
  messagingSenderId: "788261227847",
  appId: "1:788261227847:web:e9f591e314d5eabbe35062"
};
/* Namuna:
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "taom-ai-xxxx.firebaseapp.com",
  projectId: "taom-ai-xxxx",
  storageBucket: "taom-ai-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// App Check (reCAPTCHA v3) sayt kaliti — begona dasturlar AI limitini ishlatolmasligi uchun.
// google.com/recaptcha/admin → v3 → domen: makhmudus.github.io → "Site key" ni shu yerga qo‘ying.
// null bo‘lsa App Check o‘chiq.
export const APPCHECK_SITE_KEY = null;

export const FIREBASE_VERSION = '12.19.0';

// Admin(lar): zayavkalarni ko‘radi va ruxsat beradi.
// Diqqat: shu emailni firestore.rules faylidagi isAdmin() ichida ham yozing.
export const ADMIN_EMAILS = ['mahmudkilbot@gmail.com'];

// Gemini modellari — birinchisi ishlamasa (limit, mavjud emas),
// avtomatik keyingisiga o‘tadi. Hammasi bepul tarifda mavjud.
export const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];
