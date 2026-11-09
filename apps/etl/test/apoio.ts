/* *****************************************************************************
   * DA Poli-UPE · ETL                                              apoio.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { env } from 'cloudflare:workers';
import { PRIMEIRA_LINHA, type CelulaBruta, type EscritaId, type LinhaLida } from '@da-poli/dominio';
import type { FontePlanilha, Notificador } from '../src/portas';

/** In-memory sheet: rows start at PRIMEIRA_LINHA, column A receives the IDs. */
export class PlanilhaFalsa implements FontePlanilha {
  linhas: CelulaBruta[][];
  falharLeitura = false;
  falharEscrita = false;
  /** Called between the first and second read of a run, to simulate someone editing meanwhile. */
  entreLeituras: (() => void) | null = null;
  #leituras = 0;

  constructor(...linhas: CelulaBruta[][]) {
    this.linhas = linhas.map((l) => [...l]);
  }

  async ler(): Promise<LinhaLida[]> {
    if (this.falharLeitura) throw new Error('Sheets API (leitura) respondeu 503');
    if (this.#leituras++ % 2 === 1 && this.entreLeituras) this.entreLeituras();
    return this.linhas.map((celulas, i) => ({ numero: PRIMEIRA_LINHA + i, celulas: [...celulas] }));
  }

  async gravarIds(escritas: EscritaId[]): Promise<void> {
    if (this.falharEscrita) throw new Error('Sheets API (escrita) respondeu 500');
    for (const e of escritas) this.linhas[e.linha - PRIMEIRA_LINHA]![0] = e.id;
  }

  id(i: number): string {
    return String(this.linhas[i]![0] ?? '');
  }
}

export class NotificadorFalso implements Notificador {
  mensagens: string[] = [];
  async enviar(texto: string): Promise<void> {
    this.mensagens.push(texto);
  }
}

/** The ledger blocks DELETE with a trigger, so tests drop and recreate it to start clean. */
export async function limparBanco(): Promise<void> {
  const db = env.DB;
  await db.batch([
    db.prepare('DROP TRIGGER IF EXISTS transacoes_sem_delete'),
    db.prepare('DELETE FROM ids_pendentes_escrita'),
    db.prepare('DELETE FROM transacoes'),
    db.prepare('DELETE FROM divergencias'),
    db.prepare('DELETE FROM execucoes_etl'),
    db.prepare(`CREATE TRIGGER transacoes_sem_delete BEFORE DELETE ON transacoes
                BEGIN SELECT RAISE(ABORT, 'transacoes é somente inserção'); END`),
  ]);
}

export const linha = (descricao: string, tipo: string, valor: number, extra: { data?: string; categoria?: string; estornoDe?: string } = {}): CelulaBruta[] => [
  '',
  extra.data ?? '10/03/2026',
  descricao,
  tipo,
  extra.categoria ?? 'Eventos',
  valor,
  extra.estornoDe ?? '',
];
