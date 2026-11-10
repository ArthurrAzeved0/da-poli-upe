/* *****************************************************************************
   * DA Poli-UPE · Ferramentas                                   exemplo.mjs   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

/**
 * Generates .wrangler/exemplo.sql: a synthetic year of DA transactions for local development
 * and for the demo preview. Rows go through the real reconciliation (packages/dominio), so
 * hashes, chain and IDs are valid. Never load this into the production database.
 *
 *   node scripts/exemplo.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const RAIZ = new URL('..', import.meta.url).pathname;

const { outputFiles } = await build({
  entryPoints: [`${RAIZ}packages/dominio/src/index.ts`],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
});
const dominio = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

// [data, descrição, tipo, categoria, valor]
const E = 'Entrada';
const S = 'Saída';
const linhas = [
  ['2026-02-10', 'Saldo transferido da gestão anterior', E, 'Saldo inicial', 1840.0],
  ['2026-02-24', 'Venda de camisas da calourada, 1º lote', E, 'Camisas', 2350.0],
  ['2026-02-26', 'Confecção de 120 camisas da calourada', S, 'Camisas', 1980.0],
  ['2026-03-06', 'Calourada: som e iluminação', S, 'Eventos', 850.0],
  ['2026-03-06', 'Calourada: venda de ingressos', E, 'Eventos', 1620.0],
  ['2026-03-07', 'Calourada: gelo e água', S, 'Eventos', 214.5],
  ['2026-03-18', 'Venda de canecas na loja do DA', E, 'Loja do DA', 480.0],
  ['2026-03-20', 'Compra de canecas personalizadas', S, 'Loja do DA', 312.0],
  ['2026-04-02', 'Impressão de cartazes da assembleia', S, 'Materiais', 96.4],
  ['2026-04-15', 'Patrocínio da semana de engenharia', E, 'Patrocínios', 1500.0],
  ['2026-04-28', 'Coffee break da semana de engenharia', S, 'Eventos', 486.4],
  ['2026-04-29', 'Certificados e crachás da semana', S, 'Materiais', 138.0],
  ['2026-05-12', 'Venda de adesivos e chaveiros', E, 'Loja do DA', 265.0],
  ['2026-05-20', 'Conserto do micro-ondas da sala do DA', S, 'Manutenção', 180.0],
  ['2026-06-05', 'Ônibus para visita técnica', S, 'Transporte', 1200.0],
  ['2026-06-05', 'Contribuição dos estudantes para a visita técnica', E, 'Transporte', 960.0],
  ['2026-07-08', 'Venda de camisas, 2º lote', E, 'Camisas', 1180.0],
  ['2026-07-09', 'Confecção de 60 camisas, 2º lote', S, 'Camisas', 990.0],
  ['2026-08-14', 'Recepção dos calouros 2026.2', S, 'Eventos', 640.0],
  ['2026-08-21', 'Venda de canecas na loja do DA', E, 'Loja do DA', 360.0],
  ['2026-09-03', 'Material de limpeza da sala do DA', S, 'Manutenção', 74.9],
  ['2026-09-17', 'Torneio de futsal: inscrições', E, 'Eventos', 720.0],
  ['2026-09-19', 'Torneio de futsal: arbitragem e medalhas', S, 'Eventos', 410.0],
  ['2026-10-09', 'Impressão de cartazes da eleição do DA', S, 'Materiais', 120.5],
  ['2026-10-09', 'Impressão de cartazes da eleição do DA', S, 'Materiais', 120.5],
  ['2026-10-30', 'Venda de camisas, 3º lote', E, 'Camisas', 1150.0],
  ['2026-11-04', 'Confecção de camisas, 3º lote', S, 'Camisas', 940.0],
];

const AGORA = '2026-11-09T14:00:00.000Z';
const celulas = (l) => ['', l[0], l[1], l[2], l[3], l[4], l[5] ?? ''];
const planilha = (rows) => rows.map((l, i) => ({ numero: i + 2, celulas: celulas(l) }));

let { novas } = await dominio.conciliar(planilha(linhas), { transacoes: [], pendentes: new Set() }, AGORA);
// The duplicated print job gets reversed, as the board would do.
const duplicada = novas.at(-3);
const estorno = ['2026-10-10', 'Cartazes da eleição lançados em dobro', 'Estorno', 'Materiais', 120.5, duplicada.id];
const comIds = planilha(linhas).map((r, i) => ({ ...r, celulas: [novas[i].id, ...r.celulas.slice(1)] }));
const segunda = await dominio.conciliar(
  [...comIds, { numero: linhas.length + 2, celulas: celulas(estorno) }],
  { transacoes: novas, pendentes: new Set() },
  AGORA,
);
if (segunda.divergencias.length) throw new Error(JSON.stringify(segunda.divergencias, null, 2));
novas = [...novas, ...segunda.novas];

const q = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sql = [
  '-- Synthetic example data. Local development and demo only.',
  'DROP TRIGGER IF EXISTS transacoes_sem_delete;',
  'DELETE FROM ids_pendentes_escrita;',
  'DELETE FROM divergencias;',
  'DELETE FROM execucoes_etl;',
  'DELETE FROM transacoes;',
  "CREATE TRIGGER transacoes_sem_delete BEFORE DELETE ON transacoes BEGIN SELECT RAISE(ABORT, 'transacoes é somente inserção'); END;",
  ...novas.map(
    (t) =>
      `INSERT INTO transacoes (seq, id, data, descricao, tipo, categoria, valor_centavos, estorno_de, hash, hash_cadeia, lancada_em) VALUES (${[
        t.seq, t.id, t.data, t.descricao, t.tipo, t.categoria, t.valorCentavos, t.estornoDe, t.hash, t.hashCadeia, t.lancadaEm,
      ].map(q).join(', ')});`,
  ),
  `INSERT INTO execucoes_etl (iniciada_em, concluida_em, status, linhas_lidas, novas, divergencias) VALUES (${q(AGORA)}, ${q(AGORA)}, 'sucesso', ${novas.length}, ${novas.length}, 0);`,
];

mkdirSync(`${RAIZ}.wrangler`, { recursive: true });
writeFileSync(`${RAIZ}.wrangler/exemplo.sql`, `${sql.join('\n')}\n`);
const chk = await dominio.verificarCadeia(novas);
console.log(`exemplo.sql: ${novas.length} lançamentos, cadeia ${chk.ok ? 'válida' : 'QUEBRADA'}`);
