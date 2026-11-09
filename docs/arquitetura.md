# Arquitetura

## Componentes

| Peça | Tecnologia | Responsabilidade |
|---|---|---|
| Planilha | Google Sheets | Onde a diretoria lança as movimentações |
| ETL | Cloudflare Worker com Cron Trigger (`apps/etl`) | Concilia planilha e banco a cada hora, grava IDs e avisa divergências |
| Banco | Cloudflare D1 (SQLite) | Livro-razão somente inserção e registro de divergências e execuções |
| Domínio | TypeScript puro (`packages/dominio`) | Leitura e validação das linhas, conciliação, cálculo de saldo. Sem I/O, por isso testável sem infraestrutura |
| Site | Astro estático no Cloudflare Pages + Pages Functions (`apps/site`) | Páginas públicas e a API `GET /api/contas` |
| Avisos | Bot do Telegram | Canal interno da diretoria |

O ETL depende de duas interfaces (`FontePlanilha` e `Notificador`, em `apps/etl/src/portas.ts`), e não do Google ou do Telegram diretamente. Por isso os testes usam uma planilha em memória e trocar o canal de aviso não mexe na regra de negócio.

## Uma execução do ETL

```
ler planilha ─┐
              ├─► conciliar (puro) ─► registrar novas no D1 ─► reler planilha
ler banco ────┘                                              │
                                                             ▼
          avisar Telegram ◄─ sincronizar divergências ◄─ gravar IDs na planilha
```

1. **Leitura**: só a aba consolidada (`SHEET_ABA`, padrão `Transações`), colunas A–G, com valores brutos. As abas de dados brutos não são lidas. Datas chegam como número de série, para não depender da formatação regional.
2. **Conciliação** (`packages/dominio/src/conciliar.ts`), linha por linha:

   | Situação da linha | Resultado |
   |---|---|
   | Vazia | Ignorada |
   | Sem ID e válida | Nova transação: recebe o próximo elo da cadeia como ID |
   | Sem ID e inválida | Divergência `invalida` |
   | ID conhecido com o mesmo conteúdo | Nada a fazer |
   | ID conhecido com conteúdo diferente | Divergência `alterada`, indicando os campos que mudaram |
   | ID que o banco não conhece | Divergência `id_desconhecido` |
   | ID repetido | Divergência `id_duplicado` |
   | ID do banco que sumiu da planilha | Divergência `apagada` |

3. **Registro**: as novas transações e a marcação de "ID pendente de escrita" entram no D1 numa única transação.
4. **Escrita dos IDs**: antes de escrever, o ETL **relê a planilha** e confirma que cada linha ainda tem o mesmo conteúdo, porque alguém pode ter inserido uma linha acima no meio da execução. Se a linha mudou de lugar, o ID a acompanha. Se mudou de conteúdo, a escrita fica para a próxima execução.
5. **Divergências**: cada problema tem uma chave determinística. O mesmo problema visto em duas execuções gera **um** aviso, não um por hora. Quando o problema some (a linha foi restaurada), a divergência é encerrada e a diretoria é avisada.
6. **Falhas**: um erro (Google fora do ar, por exemplo) é registrado em `execucoes_etl` e avisado **uma vez**, na primeira falha seguida.

## A cadeia de hashes

```
hash        = sha256(data, descrição, tipo, categoria, valor, estorno de)
hash_cadeia = sha256(hash_cadeia anterior + hash)        (a primeira parte de 64 zeros)
ID          = "T-" + 16 primeiros caracteres de hash_cadeia
```

- Linhas com conteúdo idêntico (dois lanches iguais no mesmo dia) têm o mesmo `hash`, mas IDs diferentes, porque o elo anterior é outro.
- A ordem da cadeia é a de **lançamento** (`seq`), não a data da movimentação.
- A planilha mostra 64 bits do elo, o suficiente para identificar. A integridade não depende desse prefixo: o banco guarda o hash completo e o conteúdo original, e a comparação é sempre contra eles.
- `verificarCadeia` (em `packages/dominio/src/hash.ts`) recalcula tudo e aponta a **primeira** transação que não confere.

## Modelo de integridade

| Ameaça | Defesa |
|---|---|
| Alterar valor, data, descrição ou categoria na planilha | O hash do registro (ID + campos) não confere: divergência `alterada` |
| Apagar uma linha | O ID existe no banco e não na planilha: divergência `apagada` |
| Inventar uma linha com ID falso | O ID não existe no banco: divergência `id_desconhecido` |
| Duplicar uma linha registrada | Divergência `id_duplicado` |
| Editar o banco diretamente | Triggers bloqueiam `UPDATE` e `DELETE` em `transacoes`. A **cadeia de hashes** (cada registro inclui o hash do anterior) torna detectável qualquer alteração feita contornando os triggers (`verificarCadeia`) |
| Corrigir um erro "por fora" | Só existe estorno: uma nova linha que referencia o ID original, com o mesmo valor. Estornar duas vezes ou estornar um estorno é recusado |
| Lançamento de valor pela metade, durante a digitação | Processo: a aba consolidada só recebe linhas já conferidas nas abas de dados brutos |

O que o sistema **não** impede: lançar uma movimentação falsa como linha nova. Ela fica registrada para sempre, com data de lançamento, e só pode ser desfeita por um estorno visível. A defesa é a transparência, não o bloqueio.

## Banco de dados

Esquema em [`db/migrations`](../db/migrations):
- `transacoes`: livro-razão. Valores em centavos (inteiros), datas ISO, `hash` (do conteúdo) e `hash_cadeia`. Um `CHECK` garante que `id = 'T-' + 16 primeiros caracteres de hash_cadeia`.
- `ids_pendentes_escrita`: IDs já registrados cuja escrita na planilha ainda não foi confirmada. Evita lançar a mesma linha duas vezes se a escrita falhar.
- `divergencias`: problemas abertos e resolvidos, com o snapshot da linha.
- `execucoes_etl`: histórico das execuções. Alimenta o "atualizado em" do site.

## Limites do plano gratuito

Conferidos na documentação da Cloudflare em 2026-11:

| Limite | Valor | Como o projeto respeita |
|---|---|---|
| CPU por execução de cron | 10 ms | Hash e assinatura usam WebCrypto nativo. Espera de rede (Google, D1) não conta |
| Subrequisições por execução | 50 | Cada execução faz cerca de 12 chamadas, qualquer que seja o número de linhas: as gravações em lote passam **um único parâmetro JSON** expandido com `json_each` |
| Cron Triggers por conta | 5 | Usa 1 |
| Requisições por dia | 100 mil | A API do site responde com cache |
| D1 | 5 GB, 5 mi leituras e 100 mil escritas por dia | Ordem de grandeza de um DA: milhares de linhas por ano |

O teste `aguenta centenas de linhas com poucas consultas` (em `apps/etl/test/executar.test.ts`) registra 400 linhas de uma vez e verifica a cadeia.
