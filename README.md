# DA Poli-UPE

Site do **Diretório Acadêmico da Escola Politécnica de Pernambuco (UPE)**. O projeto foi pensado para crescer em várias páginas e funções. A primeira delas é a **prestação de contas**: o caixa do DA aberto para qualquer estudante, com proteção contra adulteração dos dados.

> Custo zero de infraestrutura: Cloudflare (Pages, Workers, D1), Google Sheets API e Telegram, todos no plano gratuito.

## Como funciona

A diretoria organiza os dados brutos (loja, camisas, eventos, extratos) em abas do Google Sheets e leva as movimentações conferidas para uma **aba consolidada**. A cada hora, um Worker da Cloudflare:

1. lê a aba consolidada;
2. registra as linhas novas num banco **somente inserção**;
3. devolve para a planilha o **ID** de cada uma.

O ID é um **elo de uma cadeia de hashes**, como numa blockchain: `hash(conteúdo da linha + ID anterior)`, por exemplo `T-a3f9c21b7e04d5f6`.

A partir daí, o registro no banco vale como fonte da verdade:
- Se alguém **alterar um valor**, **apagar uma linha** ou **inventar um ID** na planilha, a próxima execução detecta a diferença e avisa a diretoria no Telegram.
- O site continua mostrando o valor registrado.
- Correções legítimas são feitas por **lançamento de estorno**, como na contabilidade.

```
Google Sheets ──(Sheets API)──► Worker ETL (cron, a cada hora)
     ▲ grava o ID                    │ concilia
     └───────────────────────────────▼
                               D1 (somente inserção, cadeia de hashes)
                                     │
Navegador ◄── Cloudflare Pages (Astro + /api/contas)
Telegram  ◄── avisos internos de divergência
```

Detalhes em [docs/arquitetura.md](docs/arquitetura.md).

## Estrutura

```
apps/
  etl/            Worker agendado: planilha → banco, avisos no Telegram
  site/           Site Astro + Pages Functions (em construção)
packages/
  dominio/        Regras de negócio puras: leitura da planilha, conciliação, saldo
db/migrations/    Esquema do D1 (compartilhado pelo ETL e pelo site)
docs/             Arquitetura, decisões, guia da planilha e de configuração
scripts/          Ferramentas do repositório (cabeçalho de autoria)
```

## Desenvolvimento

Requisitos: Node 22+.

```bash
npm install
npm test               # testes de todos os pacotes
npm run typecheck      # TypeScript estrito em todos os pacotes
npm run db:migrate:local
npm run cabecalho      # aplica o cabeçalho de autoria em arquivos novos
```

Para rodar o ETL localmente contra uma planilha real, veja [docs/configuracao.md](docs/configuracao.md).

### Fluxo de branches e versões

- `main`: só versões lançadas, cada uma com uma tag `vX.Y.Z`.
- `develop`: integração.
- `feature/*`: uma branch por funcionalidade, saindo de `develop`.
- `release/X.Y.Z`: preparação de uma versão (número da versão e changelog), que vai para a `main` com tag e volta para a `develop`.

Versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). As mudanças de cada versão estão no [CHANGELOG](CHANGELOG.md) e nos [Releases](https://github.com/ArthurrAzeved0/da-poli-upe/releases). Commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português.

## Documentação

| Documento | Conteúdo |
|---|---|
| [Arquitetura](docs/arquitetura.md) | Componentes, fluxo de dados, modelo de integridade e limites do plano gratuito |
| [Decisões](docs/decisoes.md) | Registro das decisões técnicas e do porquê de cada uma |
| [Guia da planilha](docs/planilha.md) | Para a diretoria: como lançar, corrigir e o que gera alerta |
| [Configuração](docs/configuracao.md) | Passo a passo de contas, segredos e deploy |

## Licença

[MIT](LICENSE) © 2026 Arthur Epifanio de Azevedo · [github.com/ArthurrAzeved0](https://github.com/ArthurrAzeved0)
