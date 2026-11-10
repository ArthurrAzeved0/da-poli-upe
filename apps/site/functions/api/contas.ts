/* *****************************************************************************
   * DA Poli-UPE · Site                                            contas.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { montarContas, type LinhaLedger } from '../../src/features/contas/montar';

interface Env {
  DB: D1Database;
}

/** Public, read-only view of the ledger. Cached briefly at the edge: the ETL only runs hourly. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const [linhas, execucao] = await env.DB.batch([
      env.DB.prepare('SELECT seq, id, data, descricao, tipo, categoria, valor_centavos, estorno_de FROM transacoes ORDER BY seq'),
      env.DB.prepare("SELECT concluida_em FROM execucoes_etl WHERE status = 'sucesso' ORDER BY id DESC LIMIT 1"),
    ]);
    const atualizadoEm = (execucao!.results[0] as { concluida_em: string } | undefined)?.concluida_em ?? null;
    const corpo = montarContas(linhas!.results as unknown as LinhaLedger[], atualizadoEm);
    return Response.json(corpo, {
      headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (e) {
    console.error('api/contas', e);
    return Response.json({ erro: 'Não foi possível ler as contas agora.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
};
