import { expect, it } from 'vitest';
import { formatarReais, resumir } from '../src/saldo';

const t = (id: string, data: string, tipo: 'entrada' | 'saida' | 'estorno', categoria: string, valorCentavos: number, estornoDe: string | null = null) => ({
  id,
  data,
  tipo,
  categoria,
  valorCentavos,
  estornoDe,
});

it('calcula saldo, totais por mês e por categoria com estorno', () => {
  const r = resumir([
    t('T-000001', '2026-03-01', 'entrada', 'Mensalidades', 50000),
    t('T-000002', '2026-03-05', 'saida', 'Eventos', 12050),
    t('T-000003', '2026-04-02', 'estorno', 'Eventos', 12050, 'T-000002'),
    t('T-000004', '2026-04-10', 'saida', 'Materiais', 3000),
  ]);
  expect(r.saldoCentavos).toBe(47000);
  expect(r.entradasCentavos).toBe(50000);
  expect(r.saidasCentavos).toBe(3000);
  expect(r.porMes).toEqual([
    { mes: '2026-03', entradasCentavos: 50000, saidasCentavos: 12050 },
    { mes: '2026-04', entradasCentavos: 0, saidasCentavos: -12050 + 3000 },
  ]);
  expect(r.porCategoria).toEqual([
    { categoria: 'Eventos', entradasCentavos: 0, saidasCentavos: 0 },
    { categoria: 'Materiais', entradasCentavos: 0, saidasCentavos: 3000 },
    { categoria: 'Mensalidades', entradasCentavos: 50000, saidasCentavos: 0 },
  ]);
});

it('formata em reais', () => {
  expect(formatarReais(123456)).toBe('R$ 1.234,56');
});
