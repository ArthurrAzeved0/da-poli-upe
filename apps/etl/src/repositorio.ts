/* *****************************************************************************
   * DA Poli-UPE · ETL                                        repositorio.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { Divergencia, EstadoLedger, Tipo, Transacao } from '@da-poli/dominio';

/*
 * Bulk writes pass one JSON parameter and expand it with json_each, so every run issues a fixed,
 * small number of queries no matter how many rows the sheet has (the Workers free plan caps
 * queries and subrequests per invocation).
 */

interface LinhaTransacao {
  seq: number;
  id: string;
  data: string;
  descricao: string;
  tipo: Tipo;
  categoria: string;
  valor_centavos: number;
  estorno_de: string | null;
  impressao: string;
  hash: string;
  hash_cadeia: string;
  lancada_em: string;
}

export async function carregarEstado(db: D1Database): Promise<EstadoLedger> {
  const [transacoes, pendentes] = await db.batch([
    db.prepare('SELECT * FROM transacoes ORDER BY seq'),
    db.prepare('SELECT id FROM ids_pendentes_escrita'),
  ]);
  return {
    transacoes: (transacoes!.results as unknown as LinhaTransacao[]).map((t) => ({
      seq: t.seq,
      id: t.id,
      data: t.data,
      descricao: t.descricao,
      tipo: t.tipo,
      categoria: t.categoria,
      valorCentavos: t.valor_centavos,
      estornoDe: t.estorno_de,
      impressao: t.impressao,
      hash: t.hash,
      hashCadeia: t.hash_cadeia,
      lancadaEm: t.lancada_em,
    })),
    pendentes: new Set((pendentes!.results as { id: string }[]).map((p) => p.id)),
  };
}

/** Inserts new transactions and marks their IDs as pending write-back, atomically. */
export async function registrarNovas(db: D1Database, novas: Transacao[]): Promise<void> {
  if (novas.length === 0) return;
  const json = JSON.stringify(novas);
  await db.batch([
    db
      .prepare(
        `INSERT INTO transacoes (seq, id, data, descricao, tipo, categoria, valor_centavos, estorno_de, impressao, hash, hash_cadeia, lancada_em)
         SELECT value ->> '$.seq', value ->> '$.id', value ->> '$.data', value ->> '$.descricao', value ->> '$.tipo',
                value ->> '$.categoria', value ->> '$.valorCentavos', value ->> '$.estornoDe', value ->> '$.impressao',
                value ->> '$.hash', value ->> '$.hashCadeia', value ->> '$.lancadaEm'
         FROM json_each(?1) ORDER BY value ->> '$.seq'`,
      )
      .bind(json),
    db.prepare(`INSERT INTO ids_pendentes_escrita (id) SELECT value ->> '$.id' FROM json_each(?1)`).bind(json),
  ]);
}

export async function confirmarEscritas(db: D1Database, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.prepare('DELETE FROM ids_pendentes_escrita WHERE id IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(ids)).run();
}

export interface MudancasDivergencias {
  /** Not yet notified (new, or reopened after having been resolved). */
  novas: { chave: string; detalhe: string }[];
  /** Closed in this run because the problem is no longer visible. */
  resolvidas: { chave: string; detalhe: string }[];
}

/**
 * Upserts every divergence seen now and resolves the open ones that disappeared.
 * A divergence that comes back after being resolved is reopened and notified again.
 */
export async function sincronizarDivergencias(db: D1Database, atuais: Divergencia[], agora: string): Promise<MudancasDivergencias> {
  const json = JSON.stringify(atuais);
  const [, resolvidas, novas] = await db.batch([
    db
      .prepare(
        `INSERT INTO divergencias (chave, tipo, id_transacao, linha_planilha, detalhe, snapshot, detectada_em)
         SELECT value ->> '$.chave', value ->> '$.tipo', value ->> '$.idTransacao', value ->> '$.linhaPlanilha',
                value ->> '$.detalhe', value ->> '$.snapshot', ?2
         FROM json_each(?1) WHERE true
         ON CONFLICT (chave) DO UPDATE SET
           linha_planilha = excluded.linha_planilha,
           detalhe        = excluded.detalhe,
           notificada_em  = CASE WHEN divergencias.resolvida_em IS NULL THEN divergencias.notificada_em END,
           detectada_em   = CASE WHEN divergencias.resolvida_em IS NULL THEN divergencias.detectada_em ELSE excluded.detectada_em END,
           resolvida_em   = NULL`,
      )
      .bind(json, agora),
    db
      .prepare(
        `UPDATE divergencias SET resolvida_em = ?2
         WHERE resolvida_em IS NULL AND chave NOT IN (SELECT value ->> '$.chave' FROM json_each(?1))
         RETURNING chave, detalhe`,
      )
      .bind(json, agora),
    db.prepare('SELECT chave, detalhe FROM divergencias WHERE resolvida_em IS NULL AND notificada_em IS NULL ORDER BY detectada_em, chave'),
  ]);
  return {
    novas: novas!.results as MudancasDivergencias['novas'],
    resolvidas: resolvidas!.results as MudancasDivergencias['resolvidas'],
  };
}

export async function marcarNotificadas(db: D1Database, chaves: string[], agora: string): Promise<void> {
  if (chaves.length === 0) return;
  await db
    .prepare('UPDATE divergencias SET notificada_em = ?2 WHERE chave IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(chaves), agora)
    .run();
}

export async function statusUltimaExecucao(db: D1Database): Promise<'sucesso' | 'erro' | null> {
  const r = await db.prepare('SELECT status FROM execucoes_etl ORDER BY id DESC LIMIT 1').first<{ status: 'sucesso' | 'erro' }>();
  return r?.status ?? null;
}

export interface RegistroExecucao {
  iniciadaEm: string;
  concluidaEm: string;
  status: 'sucesso' | 'erro';
  linhasLidas: number;
  novas: number;
  divergencias: number;
  erro: string | null;
}

export async function registrarExecucao(db: D1Database, r: RegistroExecucao): Promise<void> {
  await db
    .prepare(
      `INSERT INTO execucoes_etl (iniciada_em, concluida_em, status, linhas_lidas, novas, divergencias, erro)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(r.iniciadaEm, r.concluidaEm, r.status, r.linhasLidas, r.novas, r.divergencias, r.erro)
    .run();
}
