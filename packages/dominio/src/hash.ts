import type { CamposTransacao } from './tipos';

/** Version prefix: changing the canonical form requires bumping it so old hashes stay verifiable. */
const VERSAO = 'v1';

export const HASH_GENESE = '0'.repeat(64);

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

export function impressaoDe(c: CamposTransacao): Promise<string> {
  return sha256Hex(`${VERSAO}|${canonico(c)}`);
}

export function hashDe(id: string, c: CamposTransacao): Promise<string> {
  return sha256Hex(`${VERSAO}|${id}|${canonico(c)}`);
}

export function hashCadeiaDe(anterior: string, hash: string): Promise<string> {
  return sha256Hex(`${anterior}${hash}`);
}

/** Recomputes the whole chain and returns the first transaction that breaks it, if any. */
export async function verificarCadeia(
  transacoes: ReadonlyArray<CamposTransacao & { id: string; hash: string; hashCadeia: string }>,
): Promise<{ ok: true } | { ok: false; id: string; motivo: string }> {
  let anterior = HASH_GENESE;
  for (const t of transacoes) {
    if ((await hashDe(t.id, t)) !== t.hash) return { ok: false, id: t.id, motivo: 'hash não confere com os campos' };
    if ((await hashCadeiaDe(anterior, t.hash)) !== t.hashCadeia) return { ok: false, id: t.id, motivo: 'cadeia de hashes quebrada' };
    anterior = t.hashCadeia;
  }
  return { ok: true };
}
