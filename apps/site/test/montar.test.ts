/* *****************************************************************************
   * DA Poli-UPE · Site                                       montar.test.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { describe, expect, it } from 'vitest';
import { montarContas, type LinhaLedger } from '../src/features/contas/montar';

const linha = (seq: number, data: string, tipo: LinhaLedger['tipo'], valor: number, extra: Partial<LinhaLedger> = {}): LinhaLedger => ({
  seq,
  id: `T-${String(seq).padStart(16, '0')}`,
  data,
  descricao: `Lançamento ${seq}`,
  tipo,
  categoria: 'Eventos',
  valor_centavos: valor,
  estorno_de: null,
  ...extra,
});

describe('montarContas', () => {
  const linhas = [
    linha(1, '2026-03-01', 'entrada', 50000),
    linha(2, '2026-03-05', 'saida', 12050),
    linha(3, '2026-03-06', 'estorno', 12050, { estorno_de: 'T-0000000000000002' }),
    linha(4, '2026-03-05', 'saida', 3000),
  ];

  it('nunca expõe o ID nem o hash da cadeia', () => {
    const json = JSON.stringify(montarContas(linhas, null));
    expect(json).not.toMatch(/T-\d{16}/);
    expect(json).not.toContain('hash');
  });

  it('liga estorno e transação estornada pela posição no livro', () => {
    const { lancamentos } = montarContas(linhas, null);
    const estorno = lancamentos.find((l) => l.n === 3)!;
    const original = lancamentos.find((l) => l.n === 2)!;
    expect(estorno.estornoDe).toBe(2);
    expect(estorno.efeitoCentavos).toBe(12050);
    expect(original.estornadaPor).toBe(3);
    expect(original.efeitoCentavos).toBe(-12050);
  });

  it('ordena do mais recente para o mais antigo, e no mesmo dia o último lançado primeiro', () => {
    const { lancamentos } = montarContas(linhas, null);
    expect(lancamentos.map((l) => l.n)).toEqual([3, 4, 2, 1]);
  });

  it('calcula o resumo com o estorno aplicado', () => {
    const { resumo, atualizadoEm } = montarContas(linhas, '2026-11-09T14:00:00.000Z');
    expect(resumo.saldoCentavos).toBe(47000);
    expect(resumo.saidasCentavos).toBe(3000);
    expect(atualizadoEm).toBe('2026-11-09T14:00:00.000Z');
  });

  it('funciona com o livro vazio', () => {
    const r = montarContas([], null);
    expect(r.lancamentos).toEqual([]);
    expect(r.resumo.saldoCentavos).toBe(0);
  });
});
