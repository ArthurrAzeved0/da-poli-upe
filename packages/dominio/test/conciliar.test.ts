import { describe, expect, it } from 'vitest';
import { conciliar, posicionarEscritas, type EstadoLedger } from '../src/conciliar';
import { verificarCadeia } from '../src/hash';
import type { CelulaBruta, LinhaLida } from '../src/tipos';

const AGORA = '2026-11-09T12:00:00.000Z';
const VAZIO: EstadoLedger = { transacoes: [], pendentes: new Set() };

/** Builds sheet rows starting at row 2: [ID, Data, Descrição, Tipo, Categoria, Valor, Estorno de, Lançar]. */
function planilha(...linhas: CelulaBruta[][]): LinhaLida[] {
  return linhas.map((celulas, i) => ({ numero: i + 2, celulas }));
}

const mensalidade = ['', '01/03/2026', 'Mensalidades de março', 'Entrada', 'Mensalidades', 500, '', true];
const lanche = ['', '05/03/2026', 'Lanche da calourada', 'Saída', 'Eventos', 120.5, '', true];

/** Runs a first ingestion and returns the ledger state plus the sheet with IDs written back. */
async function registrar(...linhas: CelulaBruta[][]) {
  const r = await conciliar(planilha(...linhas), VAZIO, AGORA);
  const comIds = linhas.map((l, i) => {
    const escrita = r.escritas.find((e) => e.linha === i + 2);
    return escrita ? [escrita.id, ...l.slice(1)] : l;
  });
  return { estado: { transacoes: r.novas, pendentes: new Set<string>() } as EstadoLedger, comIds, r };
}

describe('linhas novas', () => {
  it('registra linhas marcadas, gera IDs sequenciais e encadeia os hashes', async () => {
    const r = await conciliar(planilha(mensalidade, lanche), VAZIO, AGORA);
    expect(r.novas.map((t) => t.id)).toEqual(['T-000001', 'T-000002']);
    expect(r.novas[1]!.valorCentavos).toBe(12050);
    expect(r.escritas).toEqual([
      { linha: 2, id: 'T-000001', impressao: r.novas[0]!.impressao },
      { linha: 3, id: 'T-000002', impressao: r.novas[1]!.impressao },
    ]);
    expect(r.divergencias).toEqual([]);
    expect(await verificarCadeia(r.novas)).toEqual({ ok: true });
  });

  it('ignora rascunhos (Lançar desmarcado) e linhas vazias', async () => {
    const rascunho = [...mensalidade.slice(0, 7), false];
    const r = await conciliar(planilha(rascunho, ['', '', '', '', '', '', '', false], []), VAZIO, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias).toEqual([]);
  });

  it('continua a sequência e a cadeia a partir do banco', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    const r = await conciliar(planilha(...comIds, lanche), estado, AGORA);
    expect(r.novas.map((t) => t.id)).toEqual(['T-000002']);
    expect(await verificarCadeia([...estado.transacoes, ...r.novas])).toEqual({ ok: true });
  });

  it('marca como inválida uma linha com erro, sem registrar', async () => {
    const r = await conciliar(planilha(['', 'amanhã', 'x', 'Saída', 'c', 10, '', true]), VAZIO, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'invalida', linhaPlanilha: 2 });
  });
});

describe('detecção de adulteração', () => {
  it('detecta valor alterado e diz qual campo mudou', async () => {
    const { estado, comIds } = await registrar(mensalidade, lanche);
    comIds[1]![5] = 12;
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.divergencias).toHaveLength(1);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'alterada', idTransacao: 'T-000002' });
    expect(r.divergencias[0]!.detalhe).toContain('Valor');
  });

  it('detecta linha apagada', async () => {
    const { estado, comIds } = await registrar(mensalidade, lanche);
    const r = await conciliar(planilha(comIds[0]!), estado, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'apagada', idTransacao: 'T-000002', chave: 'apagada:T-000002' })]);
  });

  it('detecta ID inventado', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    const r = await conciliar(planilha(...comIds, ['T-000099', ...lanche.slice(1)]), estado, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'id_desconhecido', linhaPlanilha: 3 })]);
    expect(r.novas).toEqual([]);
  });

  it('detecta ID duplicado', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    const r = await conciliar(planilha(comIds[0]!, comIds[0]!), estado, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'id_duplicado', idTransacao: 'T-000001', linhaPlanilha: 3 })]);
  });

  it('detecta linha registrada que ficou inválida', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![3] = 'Doação';
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.divergencias[0]).toMatchObject({ tipo: 'alterada', idTransacao: 'T-000001' });
  });

  it('gera a mesma chave para o mesmo problema em execuções diferentes', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![5] = 1;
    const a = await conciliar(planilha(...comIds), estado, AGORA);
    const b = await conciliar(planilha(['novo cabeçalho?', '', '', '', '', '', '', false], ...comIds), estado, AGORA);
    expect(b.divergencias.find((d) => d.tipo === 'alterada')!.chave).toBe(a.divergencias[0]!.chave);
  });

  it('não confia na planilha: mudar só espaços não é divergência', async () => {
    const { estado, comIds } = await registrar(mensalidade);
    comIds[0]![2] = '  Mensalidades   de março ';
    const r = await conciliar(planilha(...comIds), estado, AGORA);
    expect(r.divergencias).toEqual([]);
  });
});

describe('estornos', () => {
  const estornoDoLanche = ['', '06/03/2026', 'Lanche lançado em dobro', 'Estorno', 'Eventos', 120.5, 'T-000002', true];

  it('registra estorno válido', async () => {
    const { estado, comIds } = await registrar(mensalidade, lanche);
    const r = await conciliar(planilha(...comIds, estornoDoLanche), estado, AGORA);
    expect(r.novas).toEqual([expect.objectContaining({ id: 'T-000003', tipo: 'estorno', estornoDe: 'T-000002' })]);
  });

  it('rejeita estorno de ID inexistente, valor diferente ou estorno repetido', async () => {
    const { estado, comIds } = await registrar(mensalidade, lanche);
    const inexistente = [...estornoDoLanche.slice(0, 6), 'T-000050', true];
    const valorErrado = [...estornoDoLanche.slice(0, 5), 10, 'T-000002', true];
    const r = await conciliar(planilha(...comIds, inexistente, valorErrado, estornoDoLanche, estornoDoLanche), estado, AGORA);
    expect(r.novas.map((t) => t.id)).toEqual(['T-000003']);
    expect(r.divergencias.map((d) => d.tipo)).toEqual(['invalida', 'invalida', 'invalida']);
    expect(r.divergencias[2]!.detalhe).toContain('já foi estornada');
  });
});

describe('IDs pendentes de escrita', () => {
  it('reaproveita o ID já registrado em vez de duplicar a transação', async () => {
    const primeira = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const estado: EstadoLedger = { transacoes: primeira.novas, pendentes: new Set(['T-000001']) };
    // The write-back failed: the sheet still has the row without an ID.
    const r = await conciliar(planilha(mensalidade), estado, AGORA);
    expect(r.novas).toEqual([]);
    expect(r.escritas).toEqual([expect.objectContaining({ id: 'T-000001', linha: 2 })]);
    expect(r.divergencias).toEqual([]);
  });

  it('linha pendente que sumiu vira divergência de apagada', async () => {
    const primeira = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const r = await conciliar([], { transacoes: primeira.novas, pendentes: new Set(['T-000001']) }, AGORA);
    expect(r.divergencias).toEqual([expect.objectContaining({ tipo: 'apagada', idTransacao: 'T-000001' })]);
  });
});

describe('posicionarEscritas', () => {
  it('acompanha a linha quando alguém insere outra acima', async () => {
    const r = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const deslocada = planilha(lanche.map((c, i) => (i === 7 ? false : c)), mensalidade);
    expect(await posicionarEscritas(deslocada, r.escritas)).toEqual([expect.objectContaining({ id: 'T-000001', linha: 3 })]);
  });

  it('pula a escrita se a linha mudou de conteúdo (fica pendente)', async () => {
    const r = await conciliar(planilha(mensalidade), VAZIO, AGORA);
    const editada = planilha([...mensalidade.slice(0, 5), 999, '', true]);
    expect(await posicionarEscritas(editada, r.escritas)).toEqual([]);
  });
});
