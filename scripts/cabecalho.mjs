/* *****************************************************************************
   * DA Poli-UPE · Ferramentas                                 cabecalho.mjs   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

/**
 * Adds or refreshes the authorship header at the top of every source file.
 *
 *   node scripts/cabecalho.mjs           apply to all files
 *   node scripts/cabecalho.mjs --check   exit 1 if any file is missing or has a stale header
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const PASTAS = ['apps', 'packages', 'db', 'scripts'];
const EXTENSOES = new Set(['.ts', '.tsx', '.js', '.mjs', '.sql', '.css', '.astro']);
const IGNORAR = new Set(['node_modules', 'dist', '.wrangler', '.astro', 'worker-configuration.d.ts']);

/** Project label shown on the title line, by top-level folder. */
const PROJETOS = [
  ['packages/dominio', 'DA Poli-UPE · Domínio'],
  ['apps/etl', 'DA Poli-UPE · ETL'],
  ['apps/site', 'DA Poli-UPE · Site'],
  ['db', 'DA Poli-UPE · Banco de dados'],
  ['scripts', 'DA Poli-UPE · Ferramentas'],
];

const LARGURA = 73; // content width between "   * " and " *" (80 columns in total)
const linha = (texto) => `   * ${texto.padEnd(LARGURA)} *`;

function cabecalho(projeto, arquivo) {
  const titulo = `${projeto}${' '.repeat(Math.max(1, LARGURA - projeto.length - arquivo.length - 2))}${arquivo}  `;
  return [
    `/* ${'*'.repeat(77)}`,
    linha(titulo.slice(0, LARGURA)),
    `   *${'-'.repeat(75)}*`,
    linha('Copyright © 2026  Arthur Epifanio de Azevedo'),
    linha('Licenciado sob a licença MIT — ver arquivo LICENSE.'),
    linha(''),
    linha('Autoria e desenvolvimento: Arthur Epifanio de Azevedo'),
    linha('Página:  https://github.com/ArthurrAzeved0'),
    linha('Contato: arthur_azevedo05@hotmail.com'),
    `   ${'*'.repeat(77)} */`,
  ].join('\n');
}

const EXISTENTE = /^\/\* \*{77}\n[\s\S]*?\*{77} \*\/\n*/;

function* arquivos(pasta) {
  for (const nome of readdirSync(pasta)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else if (EXTENSOES.has(nome.slice(nome.lastIndexOf('.')))) yield caminho;
  }
}

const verificar = process.argv.includes('--check');
const pendentes = [];

for (const pasta of PASTAS) {
  let raiz;
  try {
    raiz = join(RAIZ, pasta);
    statSync(raiz);
  } catch {
    continue;
  }
  for (const caminho of arquivos(raiz)) {
    const rel = relative(RAIZ, caminho).split(sep).join('/');
    const projeto = PROJETOS.find(([prefixo]) => rel.startsWith(prefixo))?.[1] ?? 'DA Poli-UPE';
    const original = readFileSync(caminho, 'utf8');
    const topo = cabecalho(projeto, basename(caminho));
    let novo;
    if (caminho.endsWith('.astro')) {
      // Astro: the header lives at the top of the frontmatter (a JS comment there never reaches the HTML).
      const semFrente = original.startsWith('---\n') ? original.slice(4) : `---\n${original}`;
      const corpo = semFrente.replace(EXISTENTE, '');
      novo = `---\n${topo}\n\n${corpo.startsWith('---\n') ? corpo : corpo}`;
    } else {
      novo = `${topo}\n\n${original.replace(EXISTENTE, '')}`;
    }
    if (novo === original) continue;
    pendentes.push(rel);
    if (!verificar) writeFileSync(caminho, novo);
  }
}

if (verificar && pendentes.length) {
  console.error(`Cabeçalho ausente ou desatualizado em:\n  ${pendentes.join('\n  ')}\nRode: node scripts/cabecalho.mjs`);
  process.exit(1);
}
console.log(verificar ? 'Cabeçalhos em dia.' : `Cabeçalho aplicado em ${pendentes.length} arquivo(s).`);
