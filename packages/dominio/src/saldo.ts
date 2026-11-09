import type { CamposTransacao, Tipo } from './tipos';

type ParaSaldo = Pick<CamposTransacao, 'data' | 'tipo' | 'categoria' | 'valorCentavos' | 'estornoDe'> & { id: string };

/**
 * Effect of each transaction on the balance, in centavos.
 * An estorno cancels the transaction it reverses, so it takes the opposite sign of that one.
 */
export function efeitos(transacoes: ReadonlyArray<ParaSaldo>): Map<string, number> {
  const porId = new Map(transacoes.map((t) => [t.id, t]));
  const sinal = (tipo: Tipo) => (tipo === 'entrada' ? 1 : -1);
  const resultado = new Map<string, number>();
  for (const t of transacoes) {
    if (t.tipo === 'estorno') {
      const alvo = t.estornoDe ? porId.get(t.estornoDe) : undefined;
      resultado.set(t.id, alvo ? -sinal(alvo.tipo) * t.valorCentavos : 0);
    } else {
      resultado.set(t.id, sinal(t.tipo) * t.valorCentavos);
    }
  }
  return resultado;
}

export interface Resumo {
  saldoCentavos: number;
  /** Gross income and expenses with reversals netted out against the original's side. */
  entradasCentavos: number;
  saidasCentavos: number;
  porMes: { mes: string; entradasCentavos: number; saidasCentavos: number }[];
  porCategoria: { categoria: string; entradasCentavos: number; saidasCentavos: number }[];
}

/**
 * Totals per side. A reversal is attributed to the side (and category) of the transaction it reverses,
 * dated on its own date, so an expense that was reversed stops counting as an expense.
 */
export function resumir(transacoes: ReadonlyArray<ParaSaldo>): Resumo {
  const porId = new Map(transacoes.map((t) => [t.id, t]));
  const meses = new Map<string, { e: number; s: number }>();
  const categorias = new Map<string, { e: number; s: number }>();
  let entradas = 0;
  let saidas = 0;

  const somar = (mapa: Map<string, { e: number; s: number }>, chave: string, lado: 'e' | 's', v: number) => {
    const atual = mapa.get(chave) ?? { e: 0, s: 0 };
    atual[lado] += v;
    mapa.set(chave, atual);
  };

  for (const t of transacoes) {
    const original = t.tipo === 'estorno' ? (t.estornoDe ? porId.get(t.estornoDe) : undefined) : t;
    if (!original) continue;
    const lado = original.tipo === 'entrada' ? 'e' : 's';
    const v = t.tipo === 'estorno' ? -t.valorCentavos : t.valorCentavos;
    if (lado === 'e') entradas += v;
    else saidas += v;
    somar(meses, t.data.slice(0, 7), lado, v);
    somar(categorias, original.categoria, lado, v);
  }

  return {
    saldoCentavos: entradas - saidas,
    entradasCentavos: entradas,
    saidasCentavos: saidas,
    porMes: [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([mes, v]) => ({ mes, entradasCentavos: v.e, saidasCentavos: v.s })),
    porCategoria: [...categorias]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([categoria, v]) => ({ categoria, entradasCentavos: v.e, saidasCentavos: v.s })),
  };
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarReais(centavos: number): string {
  return BRL.format(centavos / 100);
}
