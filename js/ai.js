// Gemini bilan ishlash: Firebase AI Logic (kalit yashirin) yoki shaxsiy API kalit.
import { MODELS, FIREBASE_VERSION } from './config.js';
import { store } from './store.js';

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
let aiMod = null, aiInst = null;

const getKey = () => { try { return localStorage.getItem('taom.geminiKey') || ''; } catch (e) { return ''; } };
export const hasPersonalKey = () => !!getKey();
export const setPersonalKey = k => { try { k ? localStorage.setItem('taom.geminiKey', k.trim()) : localStorage.removeItem('taom.geminiKey'); } catch (e) {} };
export const aiAvailable = () => hasPersonalKey() || store.mode === 'cloud';

const SYSTEM = `Siz — tajribali dietolog va oziq-ovqat tahlilchisisiz. O‘zbek, rus va jahon oshxonasini juda yaxshi bilasiz
(osh/palov, lag‘mon, manti, somsa, shashlik, norin, chuchvara, dimlama, mastava, shurva, qozon kabob, non, achchiq-chuchuk,
borsch, pelmen, plov, salatlar, shirinliklar va h.k.). O‘zbekistonda taomlar odatda yog‘liroq tayyorlanishini hisobga oling.
Vazifangiz — ovqatning kaloriyasi va makronutrientlarini iloji boricha aniq baholash.
Porsiyani rasmdagi idish, qoshiq, qo‘l, non kabi narsalarga qarab taxmin qiling.
Barcha matnlarni O‘ZBEK tilida (lotin yozuvi, o‘ va g‘ harflari bilan) yozing.
Faqat JSON qaytaring, boshqa hech narsa yozmang.`;

const SHAPE = `JSON tuzilishi:
{
  "is_food": true,                      // rasmda/matnda ovqat yoki ichimlik bo‘lmasa false
  "name": "Taom nomi (qisqa, o‘zbekcha)",
  "emoji": "🍲",
  "portion": "taxminiy porsiya, masalan: 1 likopcha, ~350 g",
  "kcal": 0,                            // butun son, butun porsiya uchun
  "protein": 0, "carbs": 0, "fat": 0, "fiber": 0,   // grammda, 1 xona aniqlikda
  "health_score": 1,                    // 1–10, foydalilik bahosi
  "items": [ { "name": "tarkibiy qism", "grams": 0, "kcal": 0 } ],
  "comment": "1–2 jumlalik foydali, iliq maslahat (o‘zbekcha). Qo‘rqitmang, qat’iy parhez tavsiya qilmang.",
  "confidence": "past | o‘rta | yuqori"
}
Agar is_food=false bo‘lsa, "comment"da nima ko‘ringanini qisqa yozing, qolgan sonlar 0.`;

async function viaFirebase(model, parts) {
  if (!aiMod) aiMod = await import(CDN + 'firebase-ai.js');
  if (!aiInst) aiInst = aiMod.getAI(store.fb.app, { backend: new aiMod.GoogleAIBackend() });
  const m = aiMod.getGenerativeModel(aiInst, {
    model,
    systemInstruction: SYSTEM,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  const req = parts.map(p => p.text != null ? p.text : { inlineData: { data: p.data, mimeType: p.mime } });
  const res = await m.generateContent(req);
  return res.response.text();
}

async function viaKey(model, parts) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: parts.map(p => p.text != null ? { text: p.text } : { inline_data: { mime_type: p.mime, data: p.data } }) }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey() },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    err.status = r.status; throw err;
  }
  const c = j.candidates && j.candidates[0];
  const t = c && c.content && c.content.parts && c.content.parts.map(p => p.text || '').join('');
  if (!t) throw new Error('AI javob bermadi');
  return t;
}

const retryable = e => {
  const s = String((e && (e.status || e.code)) || '') + ' ' + String(e && e.message || '');
  return /404|not.?found|429|quota|exhaust|rate|503|unavailable|overload|500|internal|deadline|not supported|permission/i.test(s);
};

function parseJSON(t) {
  t = String(t).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('AI javobini o‘qib bo‘lmadi');
}

const num = (v, d = 1) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 10 ** d) / 10 ** d : 0; };

function normalize(o) {
  const items = Array.isArray(o.items) ? o.items.slice(0, 12).map(i => ({
    name: String(i.name || '').slice(0, 60), grams: num(i.grams, 0), kcal: num(i.kcal, 0),
  })).filter(i => i.name) : [];
  return {
    isFood: o.is_food !== false,
    name: String(o.name || 'Taom').slice(0, 60),
    emoji: String(o.emoji || '🍽️').slice(0, 4),
    portion: String(o.portion || '').slice(0, 60),
    kcal: Math.round(num(o.kcal, 0)),
    protein: num(o.protein), carbs: num(o.carbs), fat: num(o.fat), fiber: num(o.fiber),
    health: Math.max(1, Math.min(10, Math.round(Number(o.health_score) || 5))),
    items,
    comment: String(o.comment || '').slice(0, 300),
    confidence: String(o.confidence || '').slice(0, 10),
  };
}

let lastModel = (() => { try { return localStorage.getItem('taom.model') || ''; } catch (e) { return ''; } })();

/**
 * @param {{image?: {data:string, mime:string}, text?: string, previous?: object, correction?: string}} input
 */
export async function analyzeFood(input) {
  if (!aiAvailable()) throw new Error('AI ulanmagan. Sozlamalar → “Gemini kaliti” bo‘limiga kalit kiriting.');
  const parts = [];
  let task;
  if (input.previous && input.correction) {
    task = `Avvalgi tahlil natijasi:\n${JSON.stringify(input.previous)}\n\nFoydalanuvchi tuzatishi: "${input.correction}"\n` +
      `Tuzatishni hisobga olib, butun tahlilni qaytadan hisoblang.`;
  } else if (input.image) {
    task = 'Rasmdagi ovqatni aniqlang va butun porsiyaning kaloriyasi hamda makronutrientlarini hisoblang.' +
      (input.text ? `\nFoydalanuvchi izohi: "${input.text}"` : '');
  } else {
    task = `Foydalanuvchi yegan ovqatini so‘z bilan yozdi: "${input.text}". Shu ovqatning kaloriyasi va makronutrientlarini hisoblang.`;
  }
  parts.push({ text: task + '\n\n' + SHAPE });
  if (input.image) parts.push({ data: input.image.data, mime: input.image.mime });

  const order = lastModel && MODELS.includes(lastModel) ? [lastModel, ...MODELS.filter(m => m !== lastModel)] : MODELS;
  const usePersonal = hasPersonalKey();
  let lastErr;
  for (const model of order) {
    try {
      const raw = usePersonal ? await viaKey(model, parts) : await viaFirebase(model, parts);
      const out = normalize(parseJSON(raw));
      if (model !== lastModel) { lastModel = model; try { localStorage.setItem('taom.model', model); } catch (e) {} }
      out.model = model;
      return out;
    } catch (e) {
      console.warn('[AI]', model, e);
      lastErr = e;
      if (!retryable(e)) break;
    }
  }
  throw friendly(lastErr);
}

function friendly(e) {
  const s = String(e && e.message || e);
  if (/api.?key|API_KEY_INVALID|invalid.*key/i.test(s)) return new Error('Gemini kaliti noto‘g‘ri. Sozlamalarda tekshiring.');
  if (/429|quota|exhaust|rate/i.test(s)) return new Error('Bugungi bepul AI limiti tugadi yoki juda tez so‘rov yuborildi. Bir daqiqadan so‘ng qayta urinib ko‘ring.');
  if (/location|region|not available in your country/i.test(s)) return new Error('Gemini bu hududda ishlamayapti. VPN o‘chirilganini tekshiring yoki keyinroq urinib ko‘ring.');
  if (/Failed to fetch|network|NetworkError|offline/i.test(s)) return new Error('Internet aloqasi yo‘q. Ulanib, qayta urinib ko‘ring.');
  if (/firebase.*ai|ai-logic|firebasevertexai|api-not-enabled|SERVICE_DISABLED/i.test(s)) return new Error('Firebase AI Logic yoqilmagan. Firebase konsolida AI Logic → “Get started” ni bosing.');
  return new Error('AI tahlil qila olmadi. Qayta urinib ko‘ring.');
}
