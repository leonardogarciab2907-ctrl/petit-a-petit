// Gera src/content/*.json a partir de content/palavras/*.txt e content/pilares.json
// e para com erro se alguma regra falhar.
// Uso: npm run conteudo
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './validacao.ts';
import type { Pillar } from '../src/lib/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'content', 'palavras');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.txt'))
  .sort()
  .map((name) => ({ name, txt: readFileSync(join(dir, name), 'utf8') }));
const pillars = JSON.parse(readFileSync(join(root, 'content', 'pilares.json'), 'utf8')) as Pillar[];

const { words, errors, warnings } = build(files, pillars);

for (const w of warnings) console.log('aviso: ' + w);
if (errors.length) {
  for (const e of errors) console.log('ERRO: ' + e);
  console.log(`\n${errors.length} erro(s). Nada foi gerado.`);
  process.exit(1);
}

const out = join(root, 'src', 'content');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'words.json'), JSON.stringify(words, null, 1) + '\n');
writeFileSync(join(out, 'pillars.json'), JSON.stringify(pillars, null, 1) + '\n');

const sentences = words.reduce((n, w) => n + w.sentences.length, 0);
const bridges = words.reduce((n, w) => n + w.sentences.filter((s) => s.bridge.length).length, 0);
console.log(`OK: ${words.length} palavras, ${pillars.length} pilares, ${sentences} frases (${bridges} com palavra-ponte), ${warnings.length} aviso(s).`);
