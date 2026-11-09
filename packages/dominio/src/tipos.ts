/* *****************************************************************************
   * DA Poli-UPE · Domínio                                          tipos.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

/** Kinds of transaction. An estorno reverses a previous transaction (same value, opposite effect). */
export type Tipo = 'entrada' | 'saida' | 'estorno';

/** The fields of a transaction as typed in the sheet, already normalized. */
export interface CamposTransacao {
  /** ISO date, yyyy-mm-dd. */
  data: string;
  descricao: string;
  tipo: Tipo;
  categoria: string;
  /** Always positive; the sign comes from `tipo`. */
  valorCentavos: number;
  /** ID of the reversed transaction, only when `tipo` is 'estorno'. */
  estornoDe: string | null;
}

/** A transaction recorded in the ledger. */
export interface Transacao extends CamposTransacao {
  seq: number;
  id: string;
  /** sha256 of the fields without the id: recognizes a row whose id was not written back yet. */
  impressao: string;
  /** sha256 of id + fields. */
  hash: string;
  /** sha256(previous hashCadeia + hash). */
  hashCadeia: string;
  lancadaEm: string;
}

/** A raw cell value as returned by the Sheets API (UNFORMATTED_VALUE, dates as serial numbers). */
export type CelulaBruta = string | number | boolean | null | undefined;

/** One sheet row with its 1-based row number in the spreadsheet. */
export interface LinhaLida {
  numero: number;
  celulas: CelulaBruta[];
}

export type TipoDivergencia = 'alterada' | 'apagada' | 'id_desconhecido' | 'id_duplicado' | 'invalida';

export interface Divergencia {
  /** Deterministic: the same problem seen in two runs has the same key, so it is notified once. */
  chave: string;
  tipo: TipoDivergencia;
  idTransacao: string | null;
  linhaPlanilha: number | null;
  detalhe: string;
  snapshot: string | null;
}

/** An ID to be written into column A of a sheet row. */
export interface EscritaId {
  linha: number;
  id: string;
  /** Fingerprint the row must still have when the ID is written (protects against rows shifting). */
  impressao: string;
}
