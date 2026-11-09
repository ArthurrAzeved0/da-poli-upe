/* *****************************************************************************
   * DA Poli-UPE · Domínio                                           hash.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { CamposTransacao } from './tipos';

/** Version prefix: changing the canonical form requires bumping it so old hashes stay verifiable. */
const VERSAO = 'v1';

/** The chain starts from this value. */
export const HASH_GENESE = '0'.repeat(64);

/** Hex chars of the chain hash shown as the ID (64 bits: unique for any realistic ledger). */
const TAMANHO_ID = 16;

export async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  let hex = '';
  for (const b of new Uint8Array(bytes)) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Canonical, order-stable serialization of the fields. */
export function canonico(c: CamposTransacao): string {
  return JSON.stringify([c.data, c.descricao, c.tipo, c.categoria, c.valorCentavos, c.estornoDe ?? '']);
}

/** Hash of the content alone: identical rows have identical content hashes. */
export function hashDe(c: CamposTransacao): Promise<string> {
  return sha256Hex(`${VERSAO}|${canonico(c)}`);
}

/** Next link of the chain: depends on the content and on everything recorded before it. */
export function hashCadeiaDe(anterior: string, hash: string): Promise<string> {
  return sha256Hex(`${VERSAO}|${anterior}|${hash}`);
}

export function idDe(hashCadeia: string): string {
  return `T-${hashCadeia.slice(0, TAMANHO_ID)}`;
}

/** Recomputes the whole chain in order and returns the first transaction that breaks it, if any. */
export async function verificarCadeia(
  transacoes: ReadonlyArray<CamposTransacao & { id: string; hash: string; hashCadeia: string }>,
): Promise<{ ok: true } | { ok: false; id: string; motivo: string }> {
  let anterior = HASH_GENESE;
  for (const t of transacoes) {
    if ((await hashDe(t)) !== t.hash) return { ok: false, id: t.id, motivo: 'o conteúdo não confere com o hash registrado' };
    if ((await hashCadeiaDe(anterior, t.hash)) !== t.hashCadeia) return { ok: false, id: t.id, motivo: 'a cadeia de hashes está quebrada' };
    if (idDe(t.hashCadeia) !== t.id) return { ok: false, id: t.id, motivo: 'o ID não corresponde ao elo da cadeia' };
    anterior = t.hashCadeia;
  }
  return { ok: true };
}
