/* *****************************************************************************
   * DA Poli-UPE · ETL                                             portas.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import type { EscritaId, LinhaLida } from '@da-poli/dominio';

/** Where transactions come from. The real one is Google Sheets; tests use an in-memory sheet. */
export interface FontePlanilha {
  ler(): Promise<LinhaLida[]>;
  gravarIds(escritas: EscritaId[]): Promise<void>;
}

/** Internal channel that warns the DA board. */
export interface Notificador {
  enviar(texto: string): Promise<void>;
}
