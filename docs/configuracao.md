# Configuração e deploy

Tudo abaixo é gratuito. Faça na ordem.

## 1. Google: conta de serviço

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (ex.: `da-poli`).
2. **APIs e serviços → Biblioteca** → ative a **Google Sheets API**.
3. **IAM e administrador → Contas de serviço** → **Criar conta de serviço** (ex.: `etl-prestacao-contas`). Nenhum papel é necessário.
4. Abra a conta → **Chaves → Adicionar chave → JSON**. Guarde o arquivo **fora do repositório**: o `.gitignore` bloqueia `*service-account*.json` e `credentials*.json`, mas o melhor é nem trazê-lo para cá.
5. Copie o e-mail da conta (`…@….iam.gserviceaccount.com`) e compartilhe a planilha com ele como **Editor**.

## 2. Planilha

Siga [planilha.md → Configuração da planilha](planilha.md#configuração-da-planilha-feita-uma-vez). O `SHEET_ID` é o trecho da URL entre `/d/` e `/edit`.

## 3. Telegram

1. Fale com [@BotFather](https://t.me/BotFather) → `/newbot` → guarde o **token**.
2. Crie um grupo da diretoria e adicione o bot.
3. Mande uma mensagem no grupo e abra `https://api.telegram.org/bot<TOKEN>/getUpdates`. O `chat.id`, um número negativo, é o **TELEGRAM_CHAT_ID**.

## 4. Cloudflare

```bash
npx wrangler login
npx wrangler d1 create da-poli          # copie o database_id para apps/etl/wrangler.jsonc
npm run db:migrate:remote
```

Em `apps/etl/wrangler.jsonc`, preencha `SHEET_ID`. Depois cadastre os segredos:

```bash
cd apps/etl
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT   # cole o JSON inteiro da chave
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npm run deploy
```

O cron roda no minuto 0 de cada hora. Para acompanhar: `npx wrangler tail da-poli-etl`.

## Rodar o ETL localmente

```bash
cp apps/etl/.dev.vars.example apps/etl/.dev.vars   # preencha com os valores reais
npm run db:migrate:local
cd apps/etl && npm run dev
# em outro terminal, dispara uma execução:
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

Sem Telegram configurado, os avisos aparecem no console.
