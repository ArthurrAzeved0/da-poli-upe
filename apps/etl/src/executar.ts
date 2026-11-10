/* *****************************************************************************
   * DA Poli-UPE · ETL                                           executar.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { conciliar, posicionarEscritas } from '@da-poli/dominio';
import type { FontePlanilha, Notificador } from './portas';
import {
  carregarEstado,
  confirmarEscritas,
  marcarNotificadas,
  registrarExecucao,
  registrarNovas,
  sincronizarDivergencias,
  statusUltimaExecucao,
} from './repositorio';

export interface Dependencias {
  db: D1Database;
  planilha: FontePlanilha;
  notificador: Notificador;
  agora?: () => Date;
}

export interface Relatorio {
  status: 'sucesso' | 'erro';
  linhasLidas: number;
  novas: number;
  idsGravados: number;
  idsAdiados: number;
  divergencias: number;
  erro: string | null;
}

/**
 * One ETL run:
 *  1. read the sheet and the ledger;
 *  2. reconcile (pure, in @da-poli/dominio);
 *  3. record new transactions (the ledger is the source of truth from here on);
 *  4. write the new IDs back to the sheet, re-reading it first so shifted rows are followed;
 *  5. persist divergences and warn the board about new/resolved ones.
 */
export async function executarEtl({ db, planilha, notificador, agora = () => new Date() }: Dependencias): Promise<Relatorio> {
  const iniciadaEm = agora().toISOString();
  const statusAnterior = await statusUltimaExecucao(db);

  try {
    const [linhas, estado] = await Promise.all([planilha.ler(), carregarEstado(db)]);
    const resultado = await conciliar(linhas, estado, iniciadaEm);

    await registrarNovas(db, resultado.novas);

    let gravadas: string[] = [];
    if (resultado.escritas.length > 0) {
      const posicionadas = await posicionarEscritas(await planilha.ler(), resultado.escritas);
      await planilha.gravarIds(posicionadas);
      gravadas = posicionadas.map((e) => e.id);
      await confirmarEscritas(db, gravadas);
    }

    const mudancas = await sincronizarDivergencias(db, resultado.divergencias, iniciadaEm);
    const mensagem = montarMensagem(mudancas.novas, mudancas.resolvidas);
    if (mensagem) {
      await notificador.enviar(mensagem);
      await marcarNotificadas(db, mudancas.novas.map((d) => d.chave), agora().toISOString());
    }

    const relatorio: Relatorio = {
      status: 'sucesso',
      linhasLidas: resultado.linhasLidas,
      novas: resultado.novas.length,
      idsGravados: gravadas.length,
      idsAdiados: resultado.escritas.length - gravadas.length,
      divergencias: resultado.divergencias.length,
      erro: null,
    };
    await registrarExecucao(db, { iniciadaEm, concluidaEm: agora().toISOString(), ...relatorio });
    return relatorio;
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await registrarExecucao(db, { iniciadaEm, concluidaEm: agora().toISOString(), status: 'erro', linhasLidas: 0, novas: 0, divergencias: 0, erro });
    // Warn once when it starts failing, not every hour while it keeps failing.
    if (statusAnterior !== 'erro') {
      await notificador.enviar(`⚠️ A atualização da prestação de contas falhou.\n${erro}`).catch(() => undefined);
    }
    return { status: 'erro', linhasLidas: 0, novas: 0, idsGravados: 0, idsAdiados: 0, divergencias: 0, erro };
  }
}

function montarMensagem(novas: { detalhe: string }[], resolvidas: { detalhe: string }[]): string | null {
  if (novas.length === 0 && resolvidas.length === 0) return null;
  const partes: string[] = [];
  if (novas.length > 0) {
    partes.push(`🚨 ${novas.length} divergência(s) entre a planilha e o banco:`);
    partes.push(...novas.map((d) => `• ${d.detalhe}`));
  }
  if (resolvidas.length > 0) {
    if (partes.length) partes.push('');
    partes.push(`✅ ${resolvidas.length} divergência(s) não aparecem mais na planilha:`);
    partes.push(...resolvidas.map((d) => `• ${d.detalhe}`));
  }
  partes.push('', 'O site continua mostrando os valores registrados no banco.');
  return partes.join('\n');
}
