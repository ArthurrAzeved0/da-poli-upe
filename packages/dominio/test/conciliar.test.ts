/* *****************************************************************************
   * DA Poli-UPE · Domínio                                 conciliar.test.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { describe, expect, it } from 'vitest';
import { conciliar, posicionarEscritas, type EstadoLedger } from '../src/conciliar';
import { hashCadeiaDe, hashDe, HASH_GENESE, idDe, verificarCadeia } from '../src/hash';
import type { CelulaBruta, LinhaLida } from '../src/tipos';

const AGORA = '2026-11-09T12:00:00.000Z';
const VAZIO: EstadoLedger = { transacoes: [], pendentes: new Set() };

/** Builds sheet rows starting at row 2: [ID, Data, Descrição, Tipo, Categoria, Valor, Estorno de]. */
function planilha(...linhas: CelulaBruta[][]): LinhaLida[] {
  return linhas.map((celulas, i) => ({ numero: i + 2, celulas }));
}

const mensalidade = ['', '01/03/2026', 'Mensalidades de março', 'Entrada', 'Mensalidades', 500, ''];
const lanche = ['', '05/03/2026', 'Lanche da calourada', 'Saída', 'Eventos', 120.5, ''];

/** Runs a first ingestion and returns the ledger state plus the sheet with IDs written back. */
async function registrar(...linhas: CelulaBruta[][]) {
  const r = await conciliar(planilha(...linhas), VAZIO, AGORA);
  const comIds = linhas.map((l, i) => {
    const escrita = r.escritas.find((e) => e.linha === i + 2);
    return escrita ? [escrita.id, ...l.slice(1)] : [...l];
  });
  const ids = r.novas.map((t) => t.id);
  return { estado: { transacoes: r.novas, pendentes: new Set<string>() } as EstadoLedger, comIds, ids, r };
}

describe('linhas novas', () => {
  it('registra as linhas e o ID é o elo da cadeia de hashes', async () => {
    const r = await conciliar(planilha(mensalidade, lanche), VAZIO, AGORA);
    const [a, b] = r.novas as [(typeof r.novas)[0], (typeof r.novas)[0]];

    expect(a.hashCadeia).toBe(await hashCadeiaDe(HASH_GENESE, await hashDe(a)));
    expect(b.hashCadeia).toBe(await hashCadeiaDe(a.hashCadeia, await hashDe(b)));
    expect(a.id).toBe(idDe(a.hashCadeia));
    expect(a.id).toMatch(/^T-[0-9a-f]{16}$/);
    expect(b.valorCentavos).toBe(12050);

    expect(r.escritas).toEqual([
      { linha: 2, id: a.id, hash: a.hash },
      { linha: 3, id: b.id, hash: b.hash },
    ]);
    expect(r.divergencias).toEqual([]);
    expect(await verificarCadeia(r.novas)).toEqual({ ok: true });
  });

  it('linhas idênticas recebem IDs diferentes (a cadeia muda)', async () => {
    const r = await conciliar(planilha(lanche, lanche), VAZIO, AGORA);
    expect(r.novas[0]!.hash).toBe(r.novas[1]!.hash);
    expect(r.novas[0]!.id).not.toBe(r.novas[1]!.id);
  });

  it('ignora linhas vazias', async () => {
    const r = await conciliar(planilha(['', '', '', '', '', '', ''], []), VAZIO, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias).toEqual([]);
  });

  it('continua a cadeia a partir do banco', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    const r = await conciliar(planilha(...comIds, lanche), estado, AGORA);
    expect(r.novas).toHaveLength(1);
    expect(r.novas[0]!.seq).toBe(2);
    expect(await verificarCadeia([...estado.transacoes, ...r.novas])).toEqual({ ok: true });
  });

  it('marca como inválida uma linha com erro, sem registrar', async () => {
    const r = await conciliar(planilha(['', 'amanhã', 'x', 'Saída', 'c', 10, '']), VAZIO, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'invalida', linhaPlanilha: 2 });
  });
});

describe('detecção de adulteração', () => {
  it('detecta valor alterado e diz qual campo mudou', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade, lanche);
    comIds[1]![5] = 12;
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias).toHaveLength(1);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'alterada', idTransacao: ids[1] });
    expect(r.divergencias[0]!.detalhe).toContain('Valor');
  });

  it('detecta linha apagada', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade, lanche);
    const r = await conciliar(planilha(comIds[0]!), estado, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'apagada', idTransacao: ids[1], chave: `apagada:${ids[1]}` })]);
  });

  it('detecta ID inventado, inclusive com formato válido', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    const r = await conciliar(planilha(...comIds, ['T-0123456789abcdef', ...lanche.slice(1)], ['abc', ...lanche.slice(1)]), estado, AGORA);
    expect(r.divergencias.map((d) => [d.tipo, d.linhaPlanilha])).toEqual([
      ['id_desconhecido', 3],
      ['id_desconhecido', 4],
    ]);
    expect(r.novas).toEqual([]);
  });

  it('aceita o ID digitado em maiúsculas', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![0] = String(comIds[0]![0]).toUpperCase();
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.divergencias).toEqual([]);
  });

  it('detecta ID duplicado', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade);
    const r = await conciliar(planilha(comIds[0]!, comIds[0]!), estado, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'id_duplicado', idTransacao: ids[0], linhaPlanilha: 3 })]);
  });

  it('detecta linha registrada que ficou inválida', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade);
    comIds[0]![3] = 'Doação';
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'alterada', idTransacao: ids[0] });
  });

  it('gera a mesma chave para o mesmo problema em execuções diferentes', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![5] = 1;
    const a = await conciliar(planilha(...comIds), estado, AGORA);
    const b = await conciliar(planilha(['', '', '', '', '', '', ''], ...comIds), estado, AGORA);
    expect(b.divergencias[0]!.chave).toBe(a.divergencias[0]!.chave);
  });

  it('mudar só espaços não é divergência', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![2] = '  Mensalidades   de março ';
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.divergencias).toEqual([]);
  });

  it('alterar o banco quebra a cadeia a partir da transação adulterada', async () => {
    const { estado, ids } = await registrar(mensalidade, lanche, mensalidade);
    const adulterado = estado.transacoes.map((t, i) => (i === 1 ? { ...t, valorCentavos: 100 } : t));
    expect(await verificarCadeia(adulterado)).toEqual({ ok: false, id: ids[1], motivo: expect.stringContaining('conteúdo') });
  });
});

describe('estornos', () => {
  const estornoDe = (id: string, valor = 120.5) => ['', '06/03/2026', 'Lanche lançado em dobro', 'Estorno', 'Eventos', valor, id];

  it('registra estorno válido', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade, lanche);
    const r = await conciliar(planilha(...comIds, estornoDe(ids[1]!)), estado, AGORA);
    expect(r.novas).toEqual([expect.objectContaining({ tipo: 'estorno', estornoDe: ids[1] })]);
  });

  it('rejeita estorno de ID inexistente, valor diferente ou estorno repetido', async () => {
    const { estado, comIds, ids } = await registrar(mensalidade, lanche);
    const r = await conciliar(
      planilha(...comIds, estornoDe('T-0000000000000000'), estornoDe(ids[1]!, 10), estornoDe(ids[1]!), estornoDe(ids[1]!)),
      estado,
      AGORA,
    );
    expect(r.novas).toHaveLength(1);
    expect(r.divergencias.map((d) => d.tipo)).toEqual(['invalida', 'invalida', 'invalida']);
    expect(r.divergencias[2]!.detalhe).toContain('já foi estornada');
  });
});

describe('IDs pendentes de escrita', () => {
  it('reaproveita o ID já registrado em vez de duplicar a transação', async () => {
    const primeira = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const id = primeira.novas[0]!.id;
    const estado: EstadoLedger = { transacoes: primeira.novas, pendentes: new Set([id]) };
    // The write-back failed: the sheet still has the row without an ID.
    const r = await conciliar(planilha(mensalidade), estado, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.escritas).toEqual([expect.objectContaining({ id, linha: 2 })]);
    expect(r.divergencias).toEqual([]);
  });

  it('linha pendente que sumiu vira divergência de apagada', async () => {
    const primeira = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const id = primeira.novas[0]!.id;
    const r = await conciliar([], { transacoes: primeira.novas, pendentes: new Set([id]) }, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'apagada', idTransacao: id })]);
  });
});

describe('posicionarEscritas', () => {
  it('acompanha a linha quando alguém insere outra acima', async () => {
    const r = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const deslocada = planilha(['', '', 'anotação solta', '', '', '', ''], mensalidade);
    expect(await posicionarEscritas(deslocada, r.escritas)).toEqual([expect.objectContaining({ id: r.novas[0]!.id, linha: 3 })]);
  });

  it('pula a escrita se a linha mudou de conteúdo (fica pendente)', async () => {
    const r = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const editada = planilha([...mensalidade.slice(0, 5), 999, '']);
    expect(await posicionarEscritas(editada, r.escritas)).toEqual([]);
  });
});
