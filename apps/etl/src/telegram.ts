/* *****************************************************************************
   * DA Poli-UPE · ETL                                           telegram.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { Notificador } from './portas';

/** Telegram messages are capped at 4096 characters. */
const LIMITE = 4000;

export class NotificadorTelegram implements Notificador {
  constructor(
    private readonly token: string,
    private readonly chatId: string,
  ) {}

  async enviar(texto: string): Promise<void> {
    const corpo = texto.length > LIMITE ? `${texto.slice(0, LIMITE)}\n…(mensagem cortada; veja a tabela divergencias no D1)` : texto;
    const resposta = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: this.chatId, text: corpo, disable_web_page_preview: true }),
    });
    if (!resposta.ok) throw new Error(`Telegram respondeu ${resposta.status}: ${await resposta.text()}`);
  }
}

/** Used when Telegram is not configured (local development): logs instead of sending. */
export class NotificadorConsole implements Notificador {
  async enviar(texto: string): Promise<void> {
    console.log(`[aviso interno]\n${texto}`);
  }
}
