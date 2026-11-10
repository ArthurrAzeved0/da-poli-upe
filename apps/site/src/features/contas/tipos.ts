/* *****************************************************************************
   * DA Poli-UPE · Site                                             tipos.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { Resumo, Tipo } from '@da-poli/dominio';

/**
 * Public shape of GET /api/contas. Deliberately carries no ID or hash: those are internal
 * integrity tools. Transactions are referenced by `n`, their position in the ledger.
 */
export interface LancamentoPublico {
  n: number;
  data: string;
  descricao: string;
  tipo: Tipo;
  categoria: string;
  /** Signed effect on the balance, in centavos (estorno already carries the opposite sign). */
  efeitoCentavos: number;
  /** For an estorno: the `n` of the transaction it reverses. */
  estornoDe: number | null;
  /** For a reversed transaction: the `n` of its estorno. */
  estornadaPor: number | null;
}

export interface ContasPublicas {
  atualizadoEm: string | null;
  resumo: Resumo;
  lancamentos: LancamentoPublico[];
}
