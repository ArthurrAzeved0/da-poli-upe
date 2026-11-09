# Guia da planilha (para a diretoria)

## Estrutura

Aba **`Transações`**, com a linha 1 de cabeçalho exatamente assim:

| A: ID | B: Data | C: Descrição | D: Tipo | E: Categoria | F: Valor | G: Estorno de | H: Lançar |
|---|---|---|---|---|---|---|---|
| *(automático)* | 05/03/2026 | Lanche da calourada | Saída | Eventos | 120,50 | | ☑ |

- **ID**: não digite nada aqui. O sistema preenche sozinho em até 1 hora depois que você marca "Lançar".
- **Data**: a data da movimentação (dd/mm/aaaa).
- **Tipo**: `Entrada`, `Saída` ou `Estorno`.
- **Categoria**: escolha da lista (aba `Categorias`).
- **Valor**: sempre positivo. O Tipo diz se o dinheiro entrou ou saiu.
- **Estorno de**: só para estornos, com o ID da transação que está sendo desfeita.
- **Lançar**: marque quando a linha estiver **pronta e conferida**. Linhas desmarcadas são rascunhos e o sistema ignora.

## Regra de ouro

> **Depois que uma linha recebe ID, ela não pode mais ser alterada nem apagada.**

Qualquer mudança numa linha com ID gera um alerta para a diretoria. O site continua mostrando o valor original.

## Como corrigir um erro

Lançou R$ 120,50 mas eram R$ 102,50?

1. Crie uma linha nova: Tipo **Estorno**, mesmo valor da original (120,50), "Estorno de" = ID da original (ex.: `T-000002`), e marque Lançar.
2. Crie outra linha com o valor correto (102,50) e marque Lançar.

No site, as duas operações aparecem e o saldo fica certo.

Uma transação só pode ser estornada uma vez, e o estorno precisa ter exatamente o valor da original.

## O que gera alerta no Telegram

| Situação | Exemplo |
|---|---|
| Linha com ID alterada | Mudar o valor de T-000002 de 120,50 para 12,00 |
| Linha com ID apagada | Excluir a linha de T-000002 |
| ID que o sistema nunca criou | Digitar `T-000099` numa linha nova |
| ID repetido | Copiar e colar uma linha que já tem ID |
| Linha marcada com erro | Data inválida, valor vazio, tipo desconhecido |
| Falha na atualização | Planilha inacessível, permissão removida |

Se a linha for restaurada exatamente como estava, o alerta é encerrado e a diretoria recebe a confirmação.

## Configuração da planilha (feita uma vez)

1. Crie as abas `Transações` (cabeçalho acima) e `Categorias` (uma categoria por linha na coluna A).
2. **Tipo** (coluna D): Dados → Validação → Lista de itens: `Entrada,Saída,Estorno`.
3. **Categoria** (coluna E): Dados → Validação → Lista de um intervalo: `Categorias!A:A`.
4. **Lançar** (coluna H): Inserir → Caixa de seleção.
5. **Data** (coluna B): Formatar → Número → Data.
6. **Proteja a coluna A**: Dados → Proteger páginas e intervalos → `Transações!A:A` → só você e a conta de serviço podem editar.
7. Compartilhe a planilha como **Editor** com o e-mail da conta de serviço (ver [configuracao.md](configuracao.md)).
