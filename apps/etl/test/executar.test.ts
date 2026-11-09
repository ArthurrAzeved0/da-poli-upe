/* *****************************************************************************
   * DA Poli-UPE · ETL                                      executar.test.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { env } from 'cloudflare:workers';
import { verificarCadeia } from '@da-poli/dominio';
import { beforeEach, describe, expect, it } from 'vitest';
import { executarEtl } from '../src/executar';
import { carregarEstado } from '../src/repositorio';
import worker from '../src/index';
import { limparBanco, linha, NotificadorFalso, PlanilhaFalsa } from './apoio';

let relogio = 0;
const agora = () => new Date(Date.UTC(2026, 10, 9, 12, 0, relogio++));

beforeEach(async () => {
  relogio = 0;
  await limparBanco();
});

async function rodar(planilha: PlanilhaFalsa, notificador = new NotificadorFalso()) {
  const relatorio = await executarEtl({ db: env.DB, planilha, notificador, agora });
  return { relatorio, notificador };
}

describe('primeira carga', () => {
  it('registra as linhas, grava os IDs na planilha e não avisa ninguém', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500), linha('Lanche', 'Saída', 120.5));
    const { relatorio, notificador } = await rodar(planilha);

    expect(relatorio).toMatchObject({ status: 'sucesso', novas: 2, idsGravados: 2, divergencias: 0 });
    expect([planilha.id(0), planilha.id(1)]).toEqual(['T-000001', 'T-000002']);
    expect(notificador.mensagens).toEqual([]);

    const estado = await carregarEstado(env.DB);
    expect(estado.pendentes.size).toBe(0);
    expect(await verificarCadeia(estado.transacoes)).toEqual({ ok: true });
  });

  it('aguenta centenas de linhas com poucas consultas (json_each)', async () => {
    const linhas = Array.from({ length: 400 }, (_, i) => linha(`Item ${i}`, i % 2 ? 'Saída' : 'Entrada', i + 1));
    const planilha = new PlanilhaFalsa(...linhas);
    const { relatorio } = await rodar(planilha);
    expect(relatorio.novas).toBe(400);
    expect(planilha.id(399)).toBe('T-000400');
    const estado = await carregarEstado(env.DB);
    expect(await verificarCadeia(estado.transacoes)).toEqual({ ok: true });
  });
});

describe('adulteração', () => {
  it('avisa uma vez, não repete enquanto persiste e avisa quando some', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500), linha('Lanche', 'Saída', 120.5));
    await rodar(planilha);

    planilha.linhas[1]![5] = 12; // someone lowers an expense
    const primeira = await rodar(planilha);
    expect(primeira.notificador.mensagens).toHaveLength(1);
    expect(primeira.notificador.mensagens[0]).toContain('T-000002');
    expect(primeira.notificador.mensagens[0]).toContain('Valor');

    const segunda = await rodar(planilha);
    expect(segunda.notificador.mensagens).toEqual([]);

    planilha.linhas[1]![5] = 120.5; // restored
    const terceira = await rodar(planilha);
    expect(terceira.notificador.mensagens).toHaveLength(1);
    expect(terceira.notificador.mensagens[0]).toContain('não aparecem mais');

    const abertas = await env.DB.prepare('SELECT COUNT(*) AS n FROM divergencias WHERE resolvida_em IS NULL').first<{ n: number }>();
    expect(abertas!.n).toBe(0);
  });

  it('linha apagada e ID inventado viram divergências; o banco não muda', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500), linha('Lanche', 'Saída', 120.5));
    await rodar(planilha);

    planilha.linhas.splice(1, 1);
    planilha.linhas.push(['T-000777', ...linha('Inventada', 'Saída', 10).slice(1)]);
    const { relatorio, notificador } = await rodar(planilha);

    expect(relatorio).toMatchObject({ novas: 0, divergencias: 2 });
    expect(notificador.mensagens[0]).toContain('T-000002');
    expect(notificador.mensagens[0]).toContain('T-000777');
    expect((await carregarEstado(env.DB)).transacoes).toHaveLength(2);
  });

  it('o banco recusa UPDATE e DELETE em transações', async () => {
    await rodar(new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500)));
    await expect(env.DB.prepare("UPDATE transacoes SET valor_centavos = 1 WHERE id = 'T-000001'").run()).rejects.toThrow(/somente inserção/);
    await expect(env.DB.prepare("DELETE FROM transacoes WHERE id = 'T-000001'").run()).rejects.toThrow(/somente inserção/);
  });
});

describe('falhas', () => {
  it('se a escrita do ID falha, a próxima execução reaproveita o ID em vez de duplicar', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500));
    planilha.falharEscrita = true;
    const falha = await rodar(planilha);
    expect(falha.relatorio.status).toBe('erro');
    expect((await carregarEstado(env.DB)).pendentes).toEqual(new Set(['T-000001']));

    planilha.falharEscrita = false;
    const { relatorio } = await rodar(planilha);
    expect(relatorio).toMatchObject({ status: 'sucesso', novas: 0, idsGravados: 1 });
    expect(planilha.id(0)).toBe('T-000001');
    const estado = await carregarEstado(env.DB);
    expect(estado.transacoes).toHaveLength(1);
    expect(estado.pendentes.size).toBe(0);
  });

  it('segue a linha quando alguém insere outra acima durante a execução', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500));
    planilha.entreLeituras = () => planilha.linhas.unshift(['', '', 'rascunho', '', '', '', '', false]);
    await rodar(planilha);
    expect(planilha.id(0)).toBe('');
    expect(planilha.id(1)).toBe('T-000001');
  });

  it('avisa só na primeira falha seguida de leitura da planilha', async () => {
    const planilha = new PlanilhaFalsa(linha('Mensalidades', 'Entrada', 500));
    planilha.falharLeitura = true;
    const a = await rodar(planilha);
    const b = await rodar(planilha);
    expect(a.relatorio.status).toBe('erro');
    expect(a.notificador.mensagens[0]).toContain('falhou');
    expect(b.notificador.mensagens).toEqual([]);
  });
});

it('não expõe nada por HTTP', async () => {
  const resposta = await worker.fetch();
  expect(resposta.status).toBe(404);
});
