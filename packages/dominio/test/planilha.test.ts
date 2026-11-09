/* *****************************************************************************
   * DA Poli-UPE · Domínio                                  planilha.test.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { describe, expect, it } from 'vitest';
import { dataDeSerial, lerCampos, lerData, lerTipo, lerValor, normalizarId } from '../src/planilha';

describe('lerData', () => {
  it('converte número de série do Google Sheets', () => {
    expect(dataDeSerial(45658)).toBe('2025-01-01');
  });
  it('aceita dd/mm/aaaa e aaaa-mm-dd', () => {
    expect(lerData('05/03/2026')).toBe('2026-03-05');
    expect(lerData('2026-03-05')).toBe('2026-03-05');
  });
  it('rejeita datas impossíveis', () => {
    expect(lerData('31/02/2026')).toBeNull();
    expect(lerData('ontem')).toBeNull();
  });
});

describe('lerValor', () => {
  it('converte números para centavos sem erro de ponto flutuante', () => {
    expect(lerValor(10.1)).toBe(1010);
    expect(lerValor(0.29)).toBe(29);
  });
  it('aceita texto em formato brasileiro', () => {
    expect(lerValor('R$ 1.234,56')).toBe(123456);
    expect(lerValor('50')).toBe(5000);
  });
  it('rejeita frações de centavo e texto inválido', () => {
    expect(lerValor(1.005)).toBeNull();
    expect(lerValor('1,2,3')).toBeNull();
  });
});

describe('lerTipo', () => {
  it('ignora acento e caixa', () => {
    expect(lerTipo('Saída')).toBe('saida');
    expect(lerTipo('SAIDA')).toBe('saida');
    expect(lerTipo('Entrada')).toBe('entrada');
    expect(lerTipo('outro')).toBeNull();
  });
});

describe('lerCampos', () => {
  it('normaliza espaços na descrição', () => {
    const r = lerCampos(['', '01/02/2026', '  Compra   de  material ', 'Saída', 'Materiais', 30, '']);
    expect(r.ok && r.campos.descricao).toBe('Compra de material');
  });
  it('exige "Estorno de" no estorno e proíbe nos outros tipos', () => {
    expect(lerCampos(['', '01/02/2026', 'x', 'Estorno', 'c', 30, '']).ok).toBe(false);
    expect(lerCampos(['', '01/02/2026', 'x', 'Entrada', 'c', 30, 'T-a3f9c21b7e04d5f6']).ok).toBe(false);
    const ok = lerCampos(['', '01/02/2026', 'x', 'Estorno', 'c', 30, ' t-A3F9C21B7E04D5F6 ']);
    expect(ok.ok && ok.campos.estornoDe).toBe('T-a3f9c21b7e04d5f6');
  });
  it('rejeita valor negativo', () => {
    expect(lerCampos(['', '01/02/2026', 'x', 'Saída', 'c', -30, '']).ok).toBe(false);
  });
});

it('normalizarId aceita maiúsculas e espaços, mas não inventa um ID', () => {
  expect(normalizarId(' T-A3F9C21B7E04D5F6 ')).toBe('T-a3f9c21b7e04d5f6');
  expect(normalizarId('T-123')).toBe('T-123');
  expect(normalizarId(null)).toBe('');
});
