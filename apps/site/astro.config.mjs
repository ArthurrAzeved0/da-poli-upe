/* *****************************************************************************
   * DA Poli-UPE · Site                                     astro.config.mjs   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://da-poli.pages.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
