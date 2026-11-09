/* *****************************************************************************
   * DA Poli-UPE · Domínio                                       planilha.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { CamposTransacao, CelulaBruta, Tipo } from './tipos';

/**
 * Column layout of the consolidated tab (A..G). Change here and only here.
 * The ETL reads only this tab; raw data lives in other tabs and is organized into it by the board.
 */
export const COLUNAS = {
  id: 0,
  data: 1,
  descricao: 2,
  tipo: 3,
  categoria: 4,
  valor: 5,
  estornoDe: 6,
} as const;

export const CABECALHO = ['ID', 'Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Estorno de'] as const;

/** Last column letter, for A1 ranges. */
export const ULTIMA_COLUNA = 'G';

/** First data row (row 1 is the header). */
export const PRIMEIRA_LINHA = 2;

export const PADRAO_ID = /^T-[0-9a-f]{16}$/;

/** Accepts an ID typed with any case ("t-A3F9…") and returns the canonical form, or the trimmed text if it is not an ID. */
export function normalizarId(c: CelulaBruta): string {
  const t = texto(c);
  return /^t-[0-9a-f]{16}$/i.test(t) ? `T-${t.slice(2).toLowerCase()}` : t;
}

const LIMITE_DESCRICAO = 500;
const LIMITE_CATEGORIA = 100;
/** R$ 10 milhões: anything above is a typo, not a DA transaction. */
const LIMITE_CENTAVOS = 1_000_000_000;

export function texto(c: CelulaBruta): string {
  if (c === null || c === undefined) return '';
  return String(c).normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function linhaVazia(celulas: CelulaBruta[]): boolean {
  return celulas.slice(0, CABECALHO.length).every((c) => texto(c) === '');
}

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function isoValida(ano: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  if (ano < 2000 || ano > 2100) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Google Sheets serial date: days since 1899-12-30. */
export function dataDeSerial(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000;
  const d = new Date(ms);
  return isoValida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function lerData(c: CelulaBruta): string | null {
  if (typeof c === 'number') return dataDeSerial(c);
  const t = texto(c);
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return isoValida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return isoValida(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

/** Accepts a number (reais) or pt-BR text like "R$ 1.234,56". Returns centavos. */
export function lerValor(c: CelulaBruta): number | null {
  let reais: number;
  if (typeof c === 'number') {
    reais = c;
  } else {
    const t = texto(c).replace(/^R\$\s?/i, '').replace(/\s/g, '');
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
    reais = Number(t.replace(/\./g, '').replace(',', '.'));
  }
  if (!Number.isFinite(reais)) return null;
  const centavos = Math.round(reais * 100);
  if (Math.abs(reais * 100 - centavos) > 1e-6) return null; // fractions of a centavo
  return centavos;
}

export function lerTipo(c: CelulaBruta): Tipo | null {
  const t = semAcento(texto(c)).toLowerCase();
  if (t === 'entrada') return 'entrada';
  if (t === 'saida') return 'saida';
  if (t === 'estorno') return 'estorno';
  return null;
}

export type ResultadoLeitura = { ok: true; campos: CamposTransacao } | { ok: false; erros: string[] };

/** Parses and validates the fields of a row (everything except the ID). */
export function lerCampos(celulas: CelulaBruta[]): ResultadoLeitura {
  const erros: string[] = [];

  const data = lerData(celulas[COLUNAS.data]);
  if (!data) erros.push('Data inválida (use dd/mm/aaaa)');

  const descricao = texto(celulas[COLUNAS.descricao]);
  if (!descricao) erros.push('Descrição vazia');
  else if (descricao.length > LIMITE_DESCRICAO) erros.push(`Descrição com mais de ${LIMITE_DESCRICAO} caracteres`);

  const tipo = lerTipo(celulas[COLUNAS.tipo]);
  if (!tipo) erros.push('Tipo deve ser Entrada, Saída ou Estorno');

  const categoria = texto(celulas[COLUNAS.categoria]);
  if (!categoria) erros.push('Categoria vazia');
  else if (categoria.length > LIMITE_CATEGORIA) erros.push(`Categoria com mais de ${LIMITE_CATEGORIA} caracteres`);

  const valorCentavos = lerValor(celulas[COLUNAS.valor]);
  if (valorCentavos === null) erros.push('Valor inválido');
  else if (valorCentavos <= 0) erros.push('Valor deve ser positivo (o Tipo define se entra ou sai)');
  else if (valorCentavos > LIMITE_CENTAVOS) erros.push('Valor acima do limite aceito');

  const estornoTexto = normalizarId(celulas[COLUNAS.estornoDe]);
  let estornoDe: string | null = null;
  if (tipo === 'estorno') {
    if (!PADRAO_ID.test(estornoTexto)) erros.push('Estorno precisa do ID da transação estornada em "Estorno de" (ex.: T-a3f9c21b7e04d5f6)');
    else estornoDe = estornoTexto;
  } else if (estornoTexto) {
    erros.push('"Estorno de" só pode ser preenchido quando o Tipo é Estorno');
  }

  if (erros.length > 0 || !data || !tipo || valorCentavos === null) return { ok: false, erros };
  return { ok: true, campos: { data, descricao, tipo, categoria, valorCentavos, estornoDe } };
}

/** Stable JSON of the visible cells, used as the divergence snapshot. */
export function snapshotLinha(celulas: CelulaBruta[]): string {
  const obj: Record<string, string> = {};
  CABECALHO.forEach((nome, i) => {
    obj[nome] = texto(celulas[i]);
  });
  return JSON.stringify(obj);
}
