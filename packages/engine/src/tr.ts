/**
 * Türkçe özel isim ekleri (ünlü uyumu + ünsüz yumuşaması olmadan, kesme işaretiyle):
 * Arda → Arda'nın / Arda'ya / Arda'yı / Arda'da;  Kerem → Kerem'in / Kerem'e / Kerem'i / Kerem'de
 */
const BACK = "aıou";
const FRONT = "eiöü";
const VOWELS = BACK + FRONT + "âîû";
const HARD = "fstkçşhp";

function lastVowel(word: string): string {
  const w = word.toLocaleLowerCase("tr");
  for (let i = w.length - 1; i >= 0; i--) {
    const ch = w[i]!;
    if (VOWELS.includes(ch)) return ch.replace("â", "a").replace("î", "i").replace("û", "u");
  }
  return "e";
}

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/** 4'lü uyum: ı/i/u/ü */
function i4(word: string): string {
  const v = lastVowel(word);
  return v === "a" || v === "ı" ? "ı" : v === "e" || v === "i" ? "i" : v === "o" || v === "u" ? "u" : "ü";
}

/** 2'li uyum: a/e */
function a2(word: string): string {
  return BACK.includes(lastVowel(word)) ? "a" : "e";
}

function endsWithVowel(word: string): boolean {
  return VOWELS.includes(word.toLocaleLowerCase("tr").slice(-1));
}

/** İlgi hâli: Arda'nın, Kerem'in */
export function genitive(name: string): string {
  const w = lastWord(name);
  return `${name}'${endsWithVowel(w) ? "n" : ""}${i4(w)}n`;
}

/** Yönelme hâli: Arda'ya, Kerem'e */
export function dative(name: string): string {
  const w = lastWord(name);
  return `${name}'${endsWithVowel(w) ? "y" : ""}${a2(w)}`;
}

/** Belirtme hâli: Arda'yı, Kerem'i */
export function accusative(name: string): string {
  const w = lastWord(name);
  return `${name}'${endsWithVowel(w) ? "y" : ""}${i4(w)}`;
}

/** Bulunma hâli: Arda'da, Kerem'de, Selin'de, Ahmet'te */
export function locative(name: string): string {
  const w = lastWord(name);
  const hard = HARD.includes(w.toLocaleLowerCase("tr").slice(-1));
  return `${name}'${hard ? "t" : "d"}${a2(w)}`;
}

/**
 * Yer adının yönelme hâli. Çok kelimeli tamlamalar (Kadırga Ambarı, Rodos Limanı) iyelik
 * ekiyle bittiği için "n" kaynaştırması alır: Kadırga Ambarı'na. Parantezli adlarda ek
 * paranteze yapışmasın diye "… (Güverte)" kısmı ekten sonra korunur.
 */
export function placeDative(name: string): string {
  const m = /^(.*?)\s*(\([^)]*\))$/.exec(name.trim());
  const core = m ? m[1]! : name.trim();
  const tail = m ? ` ${m[2]}` : "";
  const words = core.split(/\s+/);
  const w = words[words.length - 1] ?? core;
  const compound = words.length > 1 && /[ıiuü]$/.test(w.toLocaleLowerCase("tr"));
  const suffix = compound ? `n${a2(w)}` : `${endsWithVowel(w) ? "y" : ""}${a2(w)}`;
  return `${core}'${suffix}${tail}`;
}
