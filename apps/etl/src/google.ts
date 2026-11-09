/* *****************************************************************************
   * DA Poli-UPE · ETL                                             google.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { PRIMEIRA_LINHA, ULTIMA_COLUNA, type CelulaBruta, type EscritaId, type LinhaLida } from '@da-poli/dominio';
import type { FontePlanilha } from './portas';

interface ContaDeServico {
  client_email: string;
  private_key: string;
}

const ESCOPO = 'https://www.googleapis.com/auth/spreadsheets';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

function base64Url(dados: ArrayBuffer | string): string {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemParaDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** OAuth2 access token for a service account (JWT bearer grant, RS256 signed with WebCrypto). */
async function obterToken(conta: ContaDeServico): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64Url(JSON.stringify({ iss: conta.client_email, scope: ESCOPO, aud: URL_TOKEN, iat: agora, exp: agora + 3600 }));
  const chave = await crypto.subtle.importKey('pkcs8', pemParaDer(conta.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(`${cabecalho}.${corpo}`));

  const resposta = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${base64Url(assinatura)}`,
    }),
  });
  if (!resposta.ok) throw new Error(`Google OAuth respondeu ${resposta.status}: ${await resposta.text()}`);
  const { access_token } = (await resposta.json()) as { access_token: string };
  return access_token;
}

/** Quotes a tab name for A1 notation: 'Transações'!A2:G */
function intervalo(aba: string, a1: string): string {
  return `'${aba.replace(/'/g, "''")}'!${a1}`;
}

export class PlanilhaGoogle implements FontePlanilha {
  #token: Promise<string> | undefined;

  constructor(
    private readonly contaJson: string,
    private readonly planilhaId: string,
    private readonly aba: string,
  ) {
    if (!planilhaId) throw new Error('SHEET_ID não configurado');
  }

  #autorizacao(): Promise<string> {
    if (!this.#token) {
      let conta: ContaDeServico;
      try {
        conta = JSON.parse(this.contaJson) as ContaDeServico;
      } catch {
        throw new Error('GOOGLE_SERVICE_ACCOUNT não é um JSON válido');
      }
      this.#token = obterToken(conta);
    }
    return this.#token;
  }

  async ler(): Promise<LinhaLida[]> {
    const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    const url = `${API}/${this.planilhaId}/values/${encodeURIComponent(intervalo(this.aba, `A${PRIMEIRA_LINHA}:${ULTIMA_COLUNA}`))}?${params}`;
    const resposta = await fetch(url, { headers: { authorization: `Bearer ${await this.#autorizacao()}` } });
    if (!resposta.ok) throw new Error(`Sheets API (leitura) respondeu ${resposta.status}: ${await resposta.text()}`);
    const { values = [] } = (await resposta.json()) as { values?: CelulaBruta[][] };
    return values.map((celulas, i) => ({ numero: PRIMEIRA_LINHA + i, celulas }));
  }

  async gravarIds(escritas: EscritaId[]): Promise<void> {
    if (escritas.length === 0) return;
    const resposta = await fetch(`${API}/${this.planilhaId}/values:batchUpdate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.#autorizacao()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: escritas.map((e) => ({ range: intervalo(this.aba, `A${e.linha}`), values: [[e.id]] })),
      }),
    });
    if (!resposta.ok) throw new Error(`Sheets API (escrita) respondeu ${resposta.status}: ${await resposta.text()}`);
  }
}
