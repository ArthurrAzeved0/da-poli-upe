# Registro de decisões

Cada decisão registra o contexto, o que foi escolhido e o porquê. Decisões novas entram no fim, numeradas.

## 1. Planilha como entrada, banco como fonte da verdade
**Contexto:** a diretoria já usa Google Sheets e muda a cada gestão. Um painel administrativo exigiria login, permissões e treinamento.
**Decisão:** a planilha continua sendo a interface de lançamento. O banco D1 guarda o registro definitivo e só aceita inserções.
**Consequência:** o site nunca confia na planilha para valores já registrados. Uma edição na planilha vira alerta, não dado.

## 2. Divergências só para a diretoria
**Contexto:** um alerta público a cada erro de digitação causaria alarde injustificado.
**Decisão:** divergências são avisadas no Telegram da diretoria. O site mostra só os valores registrados.
**Consequência:** o público vê sempre dados consistentes, e a diretoria tem o dever de investigar os avisos.

## 3. Correções somente por estorno
**Contexto:** permitir edição com aprovação exigiria autenticação e um painel administrativo, além de abrir margem para "ajustes" silenciosos.
**Decisão:** uma linha registrada nunca muda. Um erro se corrige com um estorno de mesmo valor que referencia o ID original e, se for o caso, com um novo lançamento correto.
**Consequência:** todo erro e toda correção ficam visíveis no histórico.

## 4. Pages para o site, Worker separado para o ETL
**Contexto:** o Cloudflare Pages não tem Cron Triggers. A Cloudflare hoje recomenda Workers com static assets para projetos novos, mas o endereço `*.pages.dev` é mais limpo.
**Decisão:** site em `da-poli.pages.dev` e um Worker sem rota pública (`workers_dev: false`) só para o cron. Os dois usam o mesmo D1.
**Consequência:** são dois deploys. O ETL não tem superfície de ataque via HTTP.

## 5. O ID é gerado pelo Worker, não por Apps Script
**Contexto:** um script dentro da planilha pode ser editado por quem tem acesso a ela.
**Decisão:** o Worker gera IDs sequenciais legíveis (`T-000001`), que também deixam lacunas evidentes, e escreve na planilha com uma conta de serviço. A coluna de ID fica protegida.

## 6. Domínio puro em pacote próprio
**Contexto:** a mesma regra (leitura de linhas, efeito de um estorno no saldo) é usada pelo ETL e pelo site.
**Decisão:** `packages/dominio` não faz I/O e não conhece Cloudflare, Google ou Telegram.
**Consequência:** a parte mais crítica é testada rápido, sem infraestrutura (30 testes em cerca de 0,2 s). Novas páginas do site reaproveitam o pacote.

## 7. Lotes com `json_each`
**Contexto:** o plano gratuito limita consultas e subrequisições por execução.
**Decisão:** inserções e atualizações em massa enviam um único parâmetro JSON, expandido no SQL com `json_each`.
**Consequência:** o número de consultas por execução é constante, seja com 10 linhas ou com 1000.

## 8. Dinheiro em centavos inteiros
**Decisão:** valores são inteiros em centavos em todas as camadas. A conversão de reais acontece só na leitura da planilha e na formatação para exibição.
**Consequência:** nada de `0,1 + 0,2 ≠ 0,3` em saldo de caixa.

## 9. Monorepo com npm workspaces
**Decisão:** `apps/*` para o que é publicado e `packages/*` para o que é compartilhado. É a base para as próximas páginas do site sem reestruturar o repositório.
