/* *****************************************************************************
   * DA Poli-UPE · ETL                                              index.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { executarEtl } from './executar';
import { PlanilhaGoogle } from './google';
import { NotificadorConsole, NotificadorTelegram } from './telegram';

export default {
  async scheduled(_controller, env, ctx) {
    const notificador =
      env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? new NotificadorTelegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID) : new NotificadorConsole();
    ctx.waitUntil(
      (async () => {
        let planilha: PlanilhaGoogle;
        try {
          planilha = new PlanilhaGoogle(env.GOOGLE_SERVICE_ACCOUNT ?? '', env.SHEET_ID, env.SHEET_ABA);
        } catch (e) {
          console.error('ETL mal configurado:', e);
          return;
        }
        const relatorio = await executarEtl({ db: env.DB, planilha, notificador });
        console.log(JSON.stringify({ evento: 'etl', ...relatorio }));
      })(),
    );
  },

  // No public HTTP surface.
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
