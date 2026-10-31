# Taom AI 🍽️

Ovqatingizni suratga oling, kaloriyasini sun’iy intellekt (Google Gemini) hisoblaydi. Ilova bepul, o‘zbek tilida ishlaydi va telefonga ilova sifatida o‘rnatiladi.

**Ochish:** https://makhmudus.github.io/taom-ai/

## Imkoniyatlar
- Kamera, galereya yoki matn orqali ovqat qo‘shish. AI taom nomi, porsiyasi, kaloriyasi, oqsil, uglevod, yog‘, kletchatka va tarkibini aniqlaydi.
- Natijani tuzatish: porsiyani ×0.25 qadam bilan o‘zgartirish yoki AIga “guruch emas, grechka edi” deb yozish.
- Shaxsiy hisob: Google yoki email/parol bilan kirish. Ma’lumotlar bulutda saqlanadi.
- Kunlik me’yor (Mifflin–San Jeor), qolgan kaloriya halqasi va makrolar.
- Suv hisobi, vazn grafigi, 7/30 kunlik hisobot, eng ko‘p yeyilgan taomlar.
- Yorug‘ va qorong‘i rejim, internetsiz ochiladi (PWA).
- **Yopiq kirish:** har kim Google yoki email bilan kira oladi, lekin ilovadan foydalanish uchun zayavka yuboradi. Admin panelda zayavkalarni qabul qiladi, rad etadi yoki bloklaydi. “Oldindan ruxsat” ro‘yxatidagi emaillar zayavkasiz ochiladi.

## Admin
Admin emaili: `mahmudkilbot@gmail.com` (`js/config.js` → `ADMIN_EMAILS` va `firestore.rules` → `isAdmin()`). Shu email bilan Google orqali kiring → Sozlamalar → **Admin panel**.
Email/parol bilan kirmoqchi bo‘lsangiz: “Ro‘yxatdan o‘tish” → shu email va o‘z parolingiz → pochtadagi tasdiqlash havolasini bosing.

## Telefonga o‘rnatish
Android (Chrome): ⋮ → “Bosh ekranga qo‘shish” → “O‘rnatish”. Yoki ilovada: Sozlamalar → “Telefonga o‘rnatish”.

## Firebase sozlash (bir marta)
1. https://console.firebase.google.com → **Add project** → nomi `taom-ai` → Analytics kerak emas → **Create**.
2. **Build → Authentication → Get started** → *Sign-in method*: **Google** va **Email/Password** ni yoqing.
3. **Authentication → Settings → Authorized domains** → **Add domain** → `makhmudus.github.io`.
4. **Build → Firestore Database → Create database** → joylashuv (masalan `eur3`) → *production mode*. Keyin **Rules** bo‘limiga `firestore.rules` faylidagi matnni qo‘yib **Publish** bosing.
5. **Build → AI Logic → Get started** → **Gemini Developer API** (bepul) ni tanlang.
6. ⚙️ **Project settings → Your apps → Web (`</>`)** → nomi “Taom AI” → **Register** → chiqqan `firebaseConfig` ni `js/config.js` ga qo‘ying.

7. **App Check** (begonalar AI limitini ishlatolmasligi uchun):
   - https://www.google.com/recaptcha/admin/create → turi **reCAPTCHA v3** → domen `makhmudus.github.io` → **Site key** va **Secret key** ni oling.
   - Firebase → **App Check** → Apps → ilovangiz → **Fraud Defense (reCAPTCHA Enterprise)** → *Site key* ni qo‘ying → Save.
   - *Site key* ni `js/config.js` → `APPCHECK_SITE_KEY` ga qo‘ying.
   - Hammasi ishlayotganini ko‘rgach, App Check → **APIs** bo‘limida *Firebase AI Logic* va *Cloud Firestore* uchun **Enforce** ni bosing.

Loyiha **Spark (bepul)** tarifida qoladi. Billing ulamang, aks holda Gemini bepul tarifi ishlamaydi.

## Texnik
- Oddiy HTML/CSS/JS (yig‘ish shart emas), GitHub Pages’da ishlaydi.
- Firebase JS SDK 12 (Auth, Firestore, AI Logic) gstatic CDN’dan yuklanadi.
- Gemini modellari (`js/config.js`): `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash-lite` → `gemini-2.5-flash`. Biri ishlamasa, avtomatik keyingisiga o‘tadi.
- Firebase ulanmagan bo‘lsa, ilova sinov rejimida ishlaydi: ma’lumotlar telefonda saqlanadi, AI uchun Sozlamalarda shaxsiy Gemini kaliti kiritiladi.
