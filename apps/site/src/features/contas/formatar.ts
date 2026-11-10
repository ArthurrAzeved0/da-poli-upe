/* *****************************************************************************
   * DA Poli-UPE · Site                                          formatar.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { formatarReais } from '@da-poli/dominio';

export { formatarReais };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-03-07" → "07/03/2026" */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-03-07" → "07/03" */
export function formatarDiaMes(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** "2026-03" → "mar" or "mar 2026" */
export function formatarMes(mes: string, comAno = false): string {
  const [a, m] = mes.split('-');
  const nome = MESES[Number(m) - 1] ?? mes;
  return comAno ? `${nome} ${a}` : nome;
}

/** "2026-03" → "março de 2026" */
export function formatarMesLongo(mes: string): string {
  const [a, m] = mes.split('-');
  return `${MESES_LONGOS[Number(m) - 1] ?? mes} de ${a}`;
}

/** Signed value: "+ R$ 1.150,00" / "− R$ 486,40" (true minus sign). */
export function formatarComSinal(centavos: number): string {
  if (centavos === 0) return formatarReais(0);
  return `${centavos > 0 ? '+' : '−'} ${formatarReais(Math.abs(centavos))}`;
}

/** ISO timestamp → "09/11/2026 às 14h05", in Recife's time zone. */
export function formatarAtualizacao(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Recife',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}/${p('month')}/${p('year')} às ${p('hour')}h${p('minute')}`;
}

/** ISO timestamp → "09/11 · 11h00", for the plate field. */
export function formatarAtualizacaoCurta(iso: string): string {
  const longo = formatarAtualizacao(iso); // "09/11/2026 às 11h00"
  const [data, hora] = longo.split(' às ');
  return `${data!.slice(0, 5)} · ${hora}`;
}

/** First and last month of the ledger: "fev a nov de 2026" or "nov de 2025 a mar de 2026". */
export function formatarPeriodo(primeira: string, ultima: string): string {
  const [a1] = primeira.split('-');
  const [a2] = ultima.split('-');
  const m1 = formatarMes(primeira.slice(0, 7));
  const m2 = formatarMes(ultima.slice(0, 7));
  if (primeira.slice(0, 7) === ultima.slice(0, 7)) return `${m1} de ${a1}`;
  return a1 === a2 ? `${m1} a ${m2} de ${a2}` : `${m1} de ${a1} a ${m2} de ${a2}`;
}
