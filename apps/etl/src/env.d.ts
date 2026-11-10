/* *****************************************************************************
   * DA Poli-UPE · ETL                                              env.d.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

// Secrets are not declared in wrangler.jsonc, so `wrangler types` cannot see them.
// All optional: the Worker degrades to console notifications without Telegram.
interface SegredosEtl {
  GOOGLE_SERVICE_ACCOUNT?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** Test-only binding with the D1 migrations (see vitest.config.ts). */
  TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
}

interface Env extends SegredosEtl {}

declare namespace Cloudflare {
  interface Env extends SegredosEtl {}
}
