/* *****************************************************************************
   * DA Poli-UPE · Site                                     contas.client.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { ContasPublicas, LancamentoPublico } from './tipos';
import { formatarAtualizacao, formatarComSinal, formatarData, formatarDiaMes, formatarMes, formatarMesLongo, formatarPeriodo, formatarReais } from './formatar';

type Estado = 'carregando' | 'pronto' | 'vazio' | 'erro';
const SVG = 'http://www.w3.org/2000/svg';

/** Small DOM helper: text always goes through textContent, never innerHTML (descriptions come from the sheet). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...filhos: (Node | string)[]) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...filhos);
  return e;
}
function svg(tag: string, attrs: Record<string, string | number>) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/* ------------------------------------------------------------------ placa */

function definirEstado(estado: Estado) {
  const placa = document.querySelector<HTMLElement>('[data-placa]');
  if (!placa) return;
  placa.dataset.estado = estado;
  placa.setAttribute('aria-busy', String(estado === 'carregando'));
  const falha = placa.querySelector<HTMLElement>('[data-falha]');
  if (falha) falha.hidden = estado !== 'erro';
}

function campo(nome: string, texto: string) {
  const alvo = document.querySelector<HTMLElement>(`[data-campo="${nome}"]`);
  if (alvo) alvo.textContent = texto;
}

function preencherPlaca(d: ContasPublicas) {
  const numero = document.querySelector('[data-campo="saldo"] .numero');
  if (numero) numero.textContent = formatarReais(d.resumo.saldoCentavos).replace(/^-?R\$\s?/, (m) => (m.startsWith('-') ? '−' : ''));
  campo('entradas', formatarReais(d.resumo.entradasCentavos));
  campo('saidas', formatarReais(d.resumo.saidasCentavos));
  campo('lancamentos', String(d.lancamentos.length));
  const datas = d.lancamentos.map((l) => l.data).sort();
  campo('periodo', datas.length ? formatarPeriodo(datas[0]!, datas.at(-1)!) : 'Sem lançamentos');
  campo('atualizado', d.atualizadoEm ? `Atualizado em ${formatarAtualizacao(d.atualizadoEm)}` : '');
}

/* ------------------------------------------------------------- por mês */

/**
 * Drawn at the container's real width (1 SVG unit = 1 CSS px), so labels stay 13px on any screen.
 * Narrow screens show the last 6 months; the table view always has every month.
 */
function desenharMeses(d: ContasPublicas) {
  const alvo = document.querySelector<HTMLElement>('[data-grafico-mes]');
  if (!alvo || alvo.hidden) return;
  alvo.querySelector('svg')?.remove();

  const L = Math.max(280, Math.round(alvo.clientWidth));
  const estreito = L < 640;
  const meses = d.resumo.porMes.slice(estreito ? -6 : -12);
  const A = estreito ? 240 : 320;
  const topo = 12, base = A - 42, esq = estreito ? 44 : 64, dir = 4;
  const max = Math.max(1, ...meses.flatMap((m) => [m.entradasCentavos, m.saidasCentavos]));
  const passo = niceStep(max / 4);
  const teto = Math.ceil(max / passo) * passo;
  const y = (c: number) => base - (Math.max(0, c) / teto) * (base - topo);
  const largura = (L - esq - dir) / meses.length;
  const barra = Math.min(28, largura * 0.3);

  const s = svg('svg', { viewBox: `0 0 ${L} ${A}`, width: L, height: A, role: 'group', 'aria-label': 'Entradas e saídas por mês' });
  for (let v = 0; v <= teto; v += passo) {
    s.append(svg('line', { class: v === 0 ? 'base' : 'grade', x1: esq, x2: L - dir, y1: y(v), y2: y(v) }));
    const t = svg('text', { class: 'eixo', x: esq - 10, y: y(v) + 4, 'text-anchor': 'end' });
    t.textContent = rotuloEixo(v);
    s.append(t);
  }

  const dica = alvo.querySelector<HTMLElement>('[data-dica]')!;
  meses.forEach((m, i) => {
    const cx = esq + largura * i + largura / 2;
    s.append(barraArredondada(cx - barra - 1, y(m.entradasCentavos), barra, base - y(m.entradasCentavos), 'b-entrada'));
    s.append(barraArredondada(cx + 1, y(m.saidasCentavos), barra, base - y(m.saidasCentavos), 'b-saida'));
    const r = svg('text', { class: 'eixo', x: cx, y: base + 24, 'text-anchor': 'middle' });
    r.textContent = formatarMes(m.mes, i === 0 || m.mes.endsWith('-01'));
    s.append(r);

    const descricao = `${formatarMesLongo(m.mes)}: entradas ${formatarReais(m.entradasCentavos)}, saídas ${formatarReais(m.saidasCentavos)}`;
    const alvoMes = svg('rect', { class: 'alvo', x: esq + largura * i, y: topo, width: largura, height: base - topo, tabindex: 0, role: 'img', 'aria-label': descricao });
    const mostrar = () => {
      dica.replaceChildren(
        el('b', {}, formatarMesLongo(m.mes)),
        el('span', {}, 'Entradas', el('strong', {}, formatarReais(m.entradasCentavos))),
        el('span', {}, 'Saídas', el('strong', {}, formatarReais(m.saidasCentavos))),
      );
      const min = Math.min(y(m.entradasCentavos), y(m.saidasCentavos));
      dica.style.left = `${Math.min(Math.max(cx, 100), L - 100)}px`;
      dica.style.top = `${min}px`;
      dica.hidden = false;
    };
    const esconder = () => (dica.hidden = true);
    alvoMes.addEventListener('pointerenter', mostrar);
    alvoMes.addEventListener('pointerleave', esconder);
    alvoMes.addEventListener('focus', mostrar);
    alvoMes.addEventListener('blur', esconder);
    s.append(alvoMes);
  });
  alvo.prepend(s);

  const corpo = document.querySelector('[data-tabela-mes]');
  corpo?.replaceChildren(
    ...d.resumo.porMes.map((m) =>
      el('tr', {}, el('th', { scope: 'row' }, formatarMesLongo(m.mes)), el('td', {}, formatarReais(m.entradasCentavos)), el('td', {}, formatarReais(m.saidasCentavos))),
    ),
  );
}

/** Bar with 4px rounded data-end, anchored square on the baseline. */
function barraArredondada(x: number, y: number, w: number, h: number, classe: string) {
  if (h <= 0) return svg('rect', { class: classe, x, y, width: w, height: 0 });
  const r = Math.min(4, h, w / 2);
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return svg('path', { class: classe, d });
}

function niceStep(bruto: number) {
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot;
}

function rotuloEixo(centavos: number) {
  const reais = centavos / 100;
  return reais >= 1000 ? `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : reais.toLocaleString('pt-BR');
}

/* -------------------------------------------------------- por categoria */

function desenharCategorias(d: ContasPublicas) {
  for (const lado of ['entrada', 'saida'] as const) {
    const lista = document.querySelector(`[data-categorias="${lado}"]`);
    if (!lista) continue;
    const itens = d.resumo.porCategoria
      .map((c) => ({ nome: c.categoria, valor: lado === 'entrada' ? c.entradasCentavos : c.saidasCentavos }))
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const max = Math.max(1, ...itens.map((i) => i.valor));
    lista.replaceChildren(
      ...(itens.length
        ? itens.map((i) => {
            const preenchido = el('i');
            preenchido.style.width = `${(i.valor / max) * 100}%`;
            return el('li', {}, el('span', { class: 'nome' }, i.nome), el('span', { class: 'quanto' }, formatarReais(i.valor)), el('span', { class: 'trilho', 'aria-hidden': 'true' }, preenchido));
          })
        : [el('li', { class: 'nada' }, 'Nada lançado ainda.')]),
    );
  }
}

/* ------------------------------------------------------------- extrato */

function iniciarExtrato(d: ContasPublicas) {
  const form = document.querySelector<HTMLFormElement>('[data-filtros]');
  const corpo = document.querySelector('[data-linhas]');
  if (!form || !corpo) return;
  const porN = new Map(d.lancamentos.map((l) => [l.n, l]));

  const mesSel = form.querySelector<HTMLSelectElement>('[data-filtro-mes]')!;
  const catSel = form.querySelector<HTMLSelectElement>('[data-filtro-categoria]')!;
  const meses = [...new Set(d.lancamentos.map((l) => l.data.slice(0, 7)))].sort().reverse();
  mesSel.append(...meses.map((m) => el('option', { value: m }, formatarMesLongo(m))));
  const categorias = [...new Set(d.lancamentos.map((l) => l.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  catSel.append(...categorias.map((c) => el('option', { value: c }, c)));

  const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  /** An estorno belongs to the side of the transaction it reverses, as in the plate totals. */
  const lado = (l: LancamentoPublico): 'entrada' | 'saida' => {
    if (l.tipo !== 'estorno') return l.tipo;
    const original = l.estornoDe !== null ? porN.get(l.estornoDe) : undefined;
    return original && original.tipo !== 'estorno' ? original.tipo : l.efeitoCentavos >= 0 ? 'entrada' : 'saida';
  };

  const linha = (l: LancamentoPublico) => {
    const desc = el('td', { class: 'desc' }, el('span', { class: 'desc-texto' }, l.descricao));
    if (l.estornoDe !== null) {
      const original = porN.get(l.estornoDe);
      if (original) desc.append(el('span', { class: 'nota' }, 'Estorno de ', el('a', { href: `#l-${original.n}` }, `${original.descricao} (${formatarDiaMes(original.data)})`)));
    }
    if (l.estornadaPor !== null) {
      const estorno = porN.get(l.estornadaPor);
      if (estorno) desc.append(el('span', { class: 'nota' }, 'Estornada em ', el('a', { href: `#l-${estorno.n}` }, formatarData(estorno.data))));
    }
    const classe = [l.efeitoCentavos < 0 ? 'saida' : 'entrada', l.estornadaPor !== null ? 'estornada' : ''].join(' ').trim();
    return el(
      'tr',
      { id: `l-${l.n}`, class: classe },
      el('td', { class: 'data' }, formatarData(l.data)),
      desc,
      el('td', { class: 'cat' }, l.categoria),
      el('td', { class: 'num' }, formatarComSinal(l.efeitoCentavos)),
    );
  };

  const contagem = document.querySelector('[data-contagem]');
  const vazio = document.querySelector<HTMLElement>('[data-vazio]');
  const mais = document.querySelector<HTMLButtonElement>('[data-mostrar-mais]');
  const PAGINA = 30;
  let limite = PAGINA;
  let visiveis: LancamentoPublico[] = [];

  const mostrar = () => {
    corpo.replaceChildren(...visiveis.slice(0, limite).map(linha));
    if (mais) {
      const faltam = visiveis.length - limite;
      mais.hidden = faltam <= 0;
      mais.textContent = `Mostrar mais ${Math.min(PAGINA, faltam)} de ${faltam}`;
    }
  };
  mais?.addEventListener('click', () => {
    const primeiraNova = limite;
    limite += PAGINA;
    mostrar();
    // Keyboard and screen-reader users land on the first newly shown entry.
    const nova = corpo.children[primeiraNova] as HTMLElement | undefined;
    nova?.setAttribute('tabindex', '-1');
    nova?.focus({ preventScroll: true });
  });

  const aplicar = () => {
    const f = new FormData(form);
    const mes = String(f.get('mes') ?? '');
    const tipo = String(f.get('tipo') ?? '');
    const cat = String(f.get('categoria') ?? '');
    const busca = normalizar(String(f.get('busca') ?? '').trim());
    visiveis = d.lancamentos.filter(
      (l) =>
        (!mes || l.data.startsWith(mes)) &&
        (!tipo || lado(l) === tipo) &&
        (!cat || l.categoria === cat) &&
        (!busca || normalizar(l.descricao).includes(busca)),
    );
    limite = PAGINA;
    // A link to a specific entry (#l-12) must find it on the page.
    const alvoHash = /^#l-(\d+)$/.exec(location.hash);
    if (alvoHash) {
      const pos = visiveis.findIndex((l) => l.n === Number(alvoHash[1]));
      if (pos >= limite) limite = Math.ceil((pos + 1) / PAGINA) * PAGINA;
    }
    mostrar();
    const total = visiveis.reduce((s, l) => s + l.efeitoCentavos, 0);
    if (contagem) {
      contagem.textContent =
        visiveis.length === d.lancamentos.length
          ? `${d.lancamentos.length} lançamentos`
          : `${visiveis.length} de ${d.lancamentos.length} lançamentos · saldo do filtro ${formatarComSinal(total)}`;
    }
    if (vazio) {
      vazio.hidden = visiveis.length > 0;
      vazio.textContent = d.lancamentos.length ? 'Nenhuma movimentação com esses filtros.' : 'Nenhuma movimentação lançada ainda.';
    }
  };
  form.addEventListener('input', aplicar);
  form.addEventListener('submit', (e) => e.preventDefault());
  aplicar();
}

/* ------------------------------------------------- redesenho por largura */

let ultimosDados: ContasPublicas | null = null;
let observando = false;

function observarLargura() {
  const alvo = document.querySelector<HTMLElement>('[data-grafico-mes]');
  if (!alvo || observando) return;
  observando = true;
  let largura = alvo.clientWidth;
  let quadro = 0;
  new ResizeObserver(() => {
    if (alvo.clientWidth === largura) return;
    largura = alvo.clientWidth;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => ultimosDados && desenharMeses(ultimosDados));
  }).observe(alvo);
}

/* ----------------------------------------------------------- carregar */

async function carregar() {
  definirEstado('carregando');
  try {
    const resposta = await fetch('/api/contas', { headers: { accept: 'application/json' } });
    if (!resposta.ok) throw new Error(String(resposta.status));
    const dados = (await resposta.json()) as ContasPublicas;
    preencherPlaca(dados);
    const temDados = dados.lancamentos.length > 0;
    document.querySelectorAll<HTMLElement>('[data-graficos]').forEach((g) => (g.hidden = !temDados));
    if (temDados) {
      ultimosDados = dados;
      desenharMeses(dados);
      desenharCategorias(dados);
      observarLargura();
    }
    iniciarExtrato(dados);
    definirEstado(temDados ? 'pronto' : 'vazio');
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch {
    definirEstado('erro');
    const corpo = document.querySelector('[data-linhas]');
    corpo?.replaceChildren(el('tr', { class: 'carregando' }, el('td', { colspan: '4' }, 'O extrato aparece aqui assim que as contas carregarem.')));
  }
}

document.querySelector('[data-recarregar]')?.addEventListener('click', carregar);

const alternar = document.querySelector<HTMLButtonElement>('[data-alternar-tabela]');
alternar?.addEventListener('click', () => {
  const tabela = document.getElementById('tabela-mes');
  if (!tabela) return;
  const abrir = tabela.hidden;
  tabela.hidden = !abrir;
  alternar.setAttribute('aria-expanded', String(abrir));
  alternar.textContent = abrir ? 'Ver como gráfico' : 'Ver em tabela';
  document.querySelector<HTMLElement>('[data-grafico-mes]')!.hidden = abrir;
  if (!abrir && ultimosDados) desenharMeses(ultimosDados);
});

carregar();
