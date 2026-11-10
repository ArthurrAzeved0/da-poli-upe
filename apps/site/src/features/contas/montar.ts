/* *****************************************************************************
   * DA Poli-UPE · Site                                            montar.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { efeitos, resumir, type Tipo } from '@da-poli/dominio';
import type { ContasPublicas, LancamentoPublico } from './tipos';

/** A ledger row as read from D1 (only the columns the public view needs). */
export interface LinhaLedger {
  seq: number;
  id: string;
  data: string;
  descricao: string;
  tipo: Tipo;
  categoria: string;
  valor_centavos: number;
  estorno_de: string | null;
}

/** Turns ledger rows into the public payload. Pure, so it is tested without D1. */
export function montarContas(linhas: LinhaLedger[], atualizadoEm: string | null): ContasPublicas {
  const paraDominio = linhas.map((l) => ({
    id: l.id,
    data: l.data,
    tipo: l.tipo,
    categoria: l.categoria,
    valorCentavos: l.valor_centavos,
    estornoDe: l.estorno_de,
  }));
  const efeito = efeitos(paraDominio);
  const seqPorId = new Map(linhas.map((l) => [l.id, l.seq]));
  const estornadaPor = new Map<string, number>();
  for (const l of linhas) if (l.estorno_de) estornadaPor.set(l.estorno_de, l.seq);

  const lancamentos: LancamentoPublico[] = linhas
    .map((l) => ({
      n: l.seq,
      data: l.data,
      descricao: l.descricao,
      tipo: l.tipo,
      categoria: l.categoria,
      efeitoCentavos: efeito.get(l.id) ?? 0,
      estornoDe: l.estorno_de ? (seqPorId.get(l.estorno_de) ?? null) : null,
      estornadaPor: estornadaPor.get(l.id) ?? null,
    }))
    // Newest movement first; same day keeps ledger order, newest entry first.
    .sort((a, b) => b.data.localeCompare(a.data) || b.n - a.n);

  return { atualizadoEm, resumo: resumir(paraDominio), lancamentos };
}
