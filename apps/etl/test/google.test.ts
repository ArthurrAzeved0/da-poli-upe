/* *****************************************************************************
   * DA Poli-UPE · ETL                                        google.test.ts   *
   *---------------------------------------------------------------------------*
   * Copyright © 2026  Arthur Epifanio de Azevedo                              *
   * Licenciado sob a licença MIT — ver arquivo LICENSE.                       *
   *                                                                           *
   * Autoria e desenvolvimento: Arthur Epifanio de Azevedo                     *
   * Página:  https://github.com/ArthurrAzeved0                                *
   * Contato: arthur_azevedo05@hotmail.com                                     *
   ***************************************************************************** */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanilhaGoogle } from '../src/google';

/** Generates a throwaway RSA key and returns it as a service account JSON + the public key to verify signatures. */
async function contaDeTeste() {
  const par = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey('pkcs8', par.privateKey)) as ArrayBuffer);
  let bin = '';
  for (const b of der) bin += String.fromCharCode(b);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return { json: JSON.stringify({ client_email: 'etl@da-poli.iam.gserviceaccount.com', private_key: pem }), publica: par.publicKey };
}

const deBase64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

afterEach(() => vi.restoreAllMocks());

describe('PlanilhaGoogle', () => {
  it('assina o JWT, lê a aba com valores brutos e grava os IDs na coluna A', async () => {
    const { json, publica } = await contaDeTeste();
    const chamadas: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (entrada, init) => {
      const url = String(entrada);
      chamadas.push({ url, init });
      if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'tok' });
      if (url.includes('/values/')) return Response.json({ values: [['', 46091, 'Lanche', 'Saída', 'Eventos', 12.5, '', true]] });
      return Response.json({});
    });

    const planilha = new PlanilhaGoogle(json, 'abc123', 'Transações');
    const linhas = await planilha.ler();
    await planilha.gravarIds([{ linha: 2, id: 'T-000001', impressao: 'x' }]);

    expect(linhas).toEqual([{ numero: 2, celulas: ['', 46091, 'Lanche', 'Saída', 'Eventos', 12.5, '', true] }]);

    // One token for both calls.
    expect(chamadas.filter((c) => c.url.includes('oauth2')).length).toBe(1);

    // The JWT is a valid RS256 signature over header.payload with the right claims.
    const assertion = new URLSearchParams(String(chamadas[0]!.init!.body)).get('assertion')!;
    const [h, p, s] = assertion.split('.') as [string, string, string];
    const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publica, deBase64Url(s), new TextEncoder().encode(`${h}.${p}`));
    expect(valido).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(deBase64Url(p)))).toMatchObject({
      iss: 'etl@da-poli.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    });

    const leitura = chamadas[1]!.url;
    expect(decodeURIComponent(leitura)).toContain("'Transações'!A2:H");
    expect(leitura).toContain('valueRenderOption=UNFORMATTED_VALUE');
    expect(chamadas[1]!.init!.headers).toMatchObject({ authorization: 'Bearer tok' });

    expect(JSON.parse(String(chamadas[2]!.init!.body))).toEqual({
      valueInputOption: 'RAW',
      data: [{ range: "'Transações'!A2", values: [['T-000001']] }],
    });
  });

  it('não chama a API para gravar quando não há IDs', async () => {
    const espiao = vi.spyOn(globalThis, 'fetch');
    await new PlanilhaGoogle('{}', 'abc', 'Transações').gravarIds([]);
    expect(espiao).not.toHaveBeenCalled();
  });

  it('falha com mensagem clara quando o Google recusa', async () => {
    const { json } = await contaDeTeste();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid_grant', { status: 400 }));
    await expect(new PlanilhaGoogle(json, 'abc', 'Transações').ler()).rejects.toThrow(/OAuth respondeu 400/);
  });

  it('exige SHEET_ID', () => {
    expect(() => new PlanilhaGoogle('{}', '', 'Transações')).toThrow(/SHEET_ID/);
  });
});
