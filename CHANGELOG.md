# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/). Enquanto a versão for `0.x`, o site ainda está sendo construído e mudanças incompatíveis podem ocorrer entre versões menores.

## [Não lançado]

## [0.2.0] - 2026-11-09

O site no ar em https://da-poli.pages.dev.

### Adicionado
- **Página inicial** do DA com o logo e a placa de prestação de contas resumida.
- **Prestação de contas** (`/contas`) com a identidade visual "Placa do DA": saldo em destaque, entradas, saídas, número de lançamentos e período.
- **Gráficos** por mês (todos os meses; no celular com rolagem lateral começando no mês mais recente) e por categoria, com legenda e versão em tabela.
- **Extrato completo** com filtros por mês, tipo, categoria e busca sem acento. Estornos aparecem riscados e ligados à transação original nos dois sentidos. Paginação de 30 em 30.
- Estados de carregando, vazio e erro (com "Tentar de novo"). Pensado primeiro para o celular.
- **API** `GET /api/contas` (Pages Functions + D1), que não expõe ID nem hash: esses são ferramentas internas de integridade.
- Navegação central (`src/config/navegacao.ts`) para incluir páginas novas com uma linha.
- Gerador de dados de exemplo para desenvolvimento local.
- **Deploy automático**: cada atualização da `main` roda as verificações, aplica as migrações do banco e publica o ETL e o site.

### Alterado
- O cabeçalho de autoria também cobre os arquivos `.astro`.

## [0.1.0] - 2026-11-09

Fundação da prestação de contas: tudo o que acontece entre a planilha e o banco. O site ainda não está no ar.

### Adicionado
- **Domínio** (`packages/dominio`): leitura e validação das linhas da aba consolidada (datas em número de série ou dd/mm/aaaa, valores em centavos, tipos Entrada/Saída/Estorno) e conciliação pura entre planilha e banco.
- **ID por cadeia de hashes**: cada transação recebe `T-` + 16 caracteres de `sha256(elo anterior + hash do conteúdo)`. Alterar qualquer registro quebra a cadeia a partir dele.
- **Detecção de adulteração**: linha alterada (com os campos que mudaram), apagada, ID desconhecido, ID duplicado e linha inválida.
- **Estornos** como única forma de correção: mesmo valor da transação original, sem estorno duplo nem estorno de estorno.
- **Cálculo de saldo** e totais por mês e por categoria, com os estornos aplicados.
- **ETL** (`apps/etl`): Worker da Cloudflare agendado a cada hora. Lê a planilha com uma conta de serviço Google, grava os IDs de volta acompanhando linhas deslocadas e não duplica lançamentos se a escrita falhar.
- **Banco D1** somente inserção: triggers bloqueiam `UPDATE` e `DELETE`, e um `CHECK` amarra o ID ao elo da cadeia.
- **Avisos internos no Telegram**: divergências novas e resolvidas, cada uma avisada uma única vez, e falha do ETL avisada uma vez.
- Operações em lote com `json_each`, para manter o número de consultas por execução constante dentro do plano gratuito.
- Documentação: arquitetura, registro de decisões, guia da planilha para a diretoria e passo a passo de configuração.
- CI no GitHub Actions: cabeçalhos de autoria, checagem de tipos e testes (46).
- Licença MIT e cabeçalho de autoria em todos os arquivos-fonte.

[Não lançado]: https://github.com/ArthurrAzeved0/da-poli-upe/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ArthurrAzeved0/da-poli-upe/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ArthurrAzeved0/da-poli-upe/releases/tag/v0.1.0
