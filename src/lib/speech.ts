// Áudio com a voz francesa do próprio aparelho (Web Speech API), grátis e offline.

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function load() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  load();
  speechSynthesis.addEventListener?.('voiceschanged', load);
}

export function onVoicesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Vozes em francês, com as da França primeiro. */
export function frenchVoices(): SpeechSynthesisVoice[] {
  const fr = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('fr'));
  return fr.sort((a, b) => Number(b.lang.toLowerCase().includes('fr-fr')) - Number(a.lang.toLowerCase().includes('fr-fr')));
}

export function hasFrenchVoice(): boolean {
  return frenchVoices().length > 0;
}

let preferred: string | null = null;
let rate = 0.9;

export function configureSpeech(opts: { voice: string | null; rate: number }) {
  preferred = opts.voice;
  rate = opts.rate;
}

export function speak(text: string, opts: { rate?: number } = {}) {
  if (!ttsSupported()) return;
  const list = frenchVoices();
  const voice = list.find((v) => v.voiceURI === preferred) ?? list[0];
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? 'fr-FR';
  if (voice) u.voice = voice;
  u.rate = opts.rate ?? rate;
  speechSynthesis.speak(u);
}
