/* *****************************************************************************
   * DA Poli-UPE · Site                                         navegacao.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

/**
 * Single source of the site's pages. A new page is a file in src/pages plus one line here:
 * the header, the footer and the page titles all read from this list.
 */
export interface Pagina {
  href: string;
  rotulo: string;
  /** Shown in the header menu. */
  noMenu: boolean;
}

export const PAGINAS: Pagina[] = [
  { href: '/', rotulo: 'Início', noMenu: true },
  { href: '/contas', rotulo: 'Prestação de contas', noMenu: true },
];

export const SITE = {
  nome: 'DA Poli-UPE',
  nomeCompleto: 'Diretório Acadêmico da Escola Politécnica de Pernambuco',
  instituicao: 'Universidade de Pernambuco',
  repositorio: 'https://github.com/ArthurrAzeved0/da-poli-upe',
  autor: { nome: 'Arthur Azevedo', pagina: 'https://github.com/ArthurrAzeved0' },
};

export function paginaAtiva(href: string, caminho: string): boolean {
  // Static builds may report "/contas.html" or "/index.html"; compare the clean route.
  const limpo = caminho.replace(/(\/index)?\.html$/, '').replace(/\/$/, '') || '/';
  return href === '/' ? limpo === '/' : limpo === href || limpo.startsWith(`${href}/`);
}
