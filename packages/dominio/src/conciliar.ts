/* *****************************************************************************
   * DA Poli-UPE · Domínio                                      conciliar.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { hashCadeiaDe, hashDe, HASH_GENESE, impressaoDe, sha256Hex } from './hash';
import { COLUNAS, formatarId, lerCampos, linhaVazia, marcadaParaLancar, PADRAO_ID, snapshotLinha, texto } from './planilha';
import type { CamposTransacao, Divergencia, EscritaId, LinhaLida, Transacao } from './tipos';

/** What the ledger knows before this run. */
export interface EstadoLedger {
  /** All recorded transactions, ordered by seq. */
  transacoes: Transacao[];
  /** IDs inserted in a previous run whose write-back to the sheet was not confirmed. */
  pendentes: ReadonlySet<string>;
}

export interface ResultadoConciliacao {
  novas: Transacao[];
  /** IDs to write into the sheet: new transactions plus pending ones found again. */
  escritas: EscritaId[];
  /** Every problem currently visible. Keys of open divergences not listed here are resolved. */
  divergencias: Divergencia[];
  linhasLidas: number;
}

const ROTULOS: Record<keyof CamposTransacao, string> = {
  data: 'Data',
  descricao: 'Descrição',
  tipo: 'Tipo',
  categoria: 'Categoria',
  valorCentavos: 'Valor',
  estornoDe: 'Estorno de',
};

function camposDiferentes(registrado: CamposTransacao, atual: CamposTransacao): string[] {
  return (Object.keys(ROTULOS) as (keyof CamposTransacao)[])
    .filter((k) => registrado[k] !== atual[k])
    .map((k) => ROTULOS[k]);
}

/**
 * Compares the sheet with the ledger. Pure: no I/O, no clock except `agora`.
 * Never trusts the sheet over the ledger — the sheet can only add new rows.
 */
export async function conciliar(linhas: LinhaLida[], estado: EstadoLedger, agora: string): Promise<ResultadoConciliacao> {
  const porId = new Map(estado.transacoes.map((t) => [t.id, t]));
  const pendentesPorImpressao = new Map<string, Transacao[]>();
  for (const id of estado.pendentes) {
    const t = porId.get(id);
    if (!t) continue;
    const lista = pendentesPorImpressao.get(t.impressao) ?? [];
    lista.push(t);
    pendentesPorImpressao.set(t.impressao, lista);
  }

  // Reversals already used, so the same transaction cannot be reversed twice.
  const estornadas = new Set(estado.transacoes.filter((t) => t.estornoDe).map((t) => t.estornoDe as string));

  const ultima = estado.transacoes.at(-1);
  let seq = ultima?.seq ?? 0;
  let cadeia = ultima?.hashCadeia ?? HASH_GENESE;

  const vistos = new Set<string>();
  const novas: Transacao[] = [];
  const escritas: EscritaId[] = [];
  const divergencias: Divergencia[] = [];
  let linhasLidas = 0;

  for (const linha of linhas) {
    const { celulas, numero } = linha;
    if (linhaVazia(celulas)) continue;
    linhasLidas++;

    const idCelula = texto(celulas[COLUNAS.id]).toUpperCase();
    const snapshot = snapshotLinha(celulas);
    const marca = (await sha256Hex(snapshot)).slice(0, 16);

    if (idCelula) {
      const registrada = porId.get(idCelula);
      if (!registrada || !PADRAO_ID.test(idCelula)) {
        divergencias.push({
          chave: `id_desconhecido:${idCelula}:${marca}`,
          tipo: 'id_desconhecido',
          idTransacao: null,
          linhaPlanilha: numero,
          detalhe: `A linha ${numero} tem o ID "${idCelula}", que nunca foi registrado no banco.`,
          snapshot,
        });
        continue;
      }
      if (vistos.has(idCelula)) {
        divergencias.push({
          chave: `id_duplicado:${idCelula}:${marca}`,
          tipo: 'id_duplicado',
          idTransacao: idCelula,
          linhaPlanilha: numero,
          detalhe: `O ID ${idCelula} aparece de novo na linha ${numero}.`,
          snapshot,
        });
        continue;
      }
      vistos.add(idCelula);

      const lido = lerCampos(celulas);
      if (!lido.ok) {
        divergencias.push({
          chave: `alterada:${idCelula}:${marca}`,
          tipo: 'alterada',
          idTransacao: idCelula,
          linhaPlanilha: numero,
          detalhe: `A transação ${idCelula} (linha ${numero}) foi alterada e ficou inválida: ${lido.erros.join('; ')}.`,
          snapshot,
        });
        continue;
      }
      if ((await hashDe(idCelula, lido.campos)) !== registrada.hash) {
        const campos = camposDiferentes(registrada, lido.campos);
        divergencias.push({
          chave: `alterada:${idCelula}:${marca}`,
          tipo: 'alterada',
          idTransacao: idCelula,
          linhaPlanilha: numero,
          detalhe: `A transação ${idCelula} (linha ${numero}) foi alterada na planilha. Campos diferentes do registro: ${campos.join(', ')}.`,
          snapshot,
        });
      }
      continue;
    }

    // Row without an ID: a draft until "Lançar" is checked.
    if (!marcadaParaLancar(celulas[COLUNAS.lancar])) continue;

    const lido = lerCampos(celulas);
    if (!lido.ok) {
      divergencias.push({
        chave: `invalida:${marca}`,
        tipo: 'invalida',
        idTransacao: null,
        linhaPlanilha: numero,
        detalhe: `A linha ${numero} está marcada para lançar mas tem erros: ${lido.erros.join('; ')}.`,
        snapshot,
      });
      continue;
    }
    const campos = lido.campos;
    const impressao = await impressaoDe(campos);

    // Recorded in a previous run, but the ID never reached the sheet: write it again instead of duplicating.
    const pendente = pendentesPorImpressao.get(impressao)?.find((t) => !vistos.has(t.id));
    if (pendente) {
      vistos.add(pendente.id);
      escritas.push({ linha: numero, id: pendente.id, impressao });
      continue;
    }

    if (campos.tipo === 'estorno') {
      const alvo = porId.get(campos.estornoDe as string);
      let erro: string | null = null;
      if (!alvo) erro = `"Estorno de" aponta para ${campos.estornoDe}, que não existe`;
      else if (alvo.tipo === 'estorno') erro = 'não é possível estornar um estorno';
      else if (estornadas.has(alvo.id)) erro = `${alvo.id} já foi estornada`;
      else if (alvo.valorCentavos !== campos.valorCentavos) erro = `o valor do estorno deve ser igual ao de ${alvo.id}`;
      if (erro) {
        divergencias.push({
          chave: `invalida:${marca}`,
          tipo: 'invalida',
          idTransacao: null,
          linhaPlanilha: numero,
          detalhe: `A linha ${numero} é um estorno inválido: ${erro}.`,
          snapshot,
        });
        continue;
      }
      estornadas.add(alvo!.id);
    }

    seq++;
    const id = formatarId(seq);
    const hash = await hashDe(id, campos);
    cadeia = await hashCadeiaDe(cadeia, hash);
    const nova: Transacao = { ...campos, seq, id, impressao, hash, hashCadeia: cadeia, lancadaEm: agora };
    novas.push(nova);
    porId.set(id, nova);
    vistos.add(id);
    escritas.push({ linha: numero, id, impressao });
  }

  for (const t of estado.transacoes) {
    if (vistos.has(t.id)) continue;
    divergencias.push({
      chave: `apagada:${t.id}`,
      tipo: 'apagada',
      idTransacao: t.id,
      linhaPlanilha: null,
      detalhe: estado.pendentes.has(t.id)
        ? `A transação ${t.id} foi registrada, mas a linha dela sumiu da planilha antes de receber o ID.`
        : `A transação ${t.id} (${t.descricao}) não está mais na planilha.`,
      snapshot: null,
    });
  }

  return { novas, escritas, divergencias, linhasLidas };
}

/**
 * Rows can move between reading the sheet and writing the IDs (someone inserts or deletes a row).
 * Given a fresh read, confirm each target row still holds the same content and has no ID;
 * otherwise look for the row elsewhere. Writes that cannot be placed are skipped and retried next run.
 */
export async function posicionarEscritas(linhasAtuais: LinhaLida[], escritas: EscritaId[]): Promise<EscritaId[]> {
  const candidatas = new Map<number, string>();
  for (const l of linhasAtuais) {
    if (texto(l.celulas[COLUNAS.id])) continue;
    if (!marcadaParaLancar(l.celulas[COLUNAS.lancar])) continue;
    const lido = lerCampos(l.celulas);
    if (lido.ok) candidatas.set(l.numero, await impressaoDe(lido.campos));
  }

  const usadas = new Set<number>();
  const resultado: EscritaId[] = [];
  for (const e of escritas) {
    let alvo: number | undefined;
    if (candidatas.get(e.linha) === e.impressao && !usadas.has(e.linha)) {
      alvo = e.linha;
    } else {
      for (const [numero, impressao] of candidatas) {
        if (impressao === e.impressao && !usadas.has(numero)) {
          alvo = numero;
          break;
        }
      }
    }
    if (alvo === undefined) continue;
    usadas.add(alvo);
    resultado.push({ ...e, linha: alvo });
  }
  return resultado;
}
