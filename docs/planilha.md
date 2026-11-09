# Guia da planilha (para a diretoria)

## Como a planilha é organizada

A planilha pode ter quantas abas forem necessárias. Abas de **dados brutos** guardam vendas da loja, camisas, eventos, extratos e o que mais houver: é ali que a diretoria organiza as informações. O sistema **não lê** essas abas.

Uma aba é a **consolidada** (por padrão `Transações`). Nela entram as movimentações já organizadas, no formato abaixo, e **só ela** é lida pelo sistema:

| A: ID | B: Data | C: Descrição | D: Tipo | E: Categoria | F: Valor | G: Estorno de |
|---|---|---|---|---|---|---|
| *(automático)* | 05/03/2026 | Lanche da calourada | Saída | Eventos | 120,50 | |

- **ID**: não digite nada. O sistema preenche sozinho na próxima atualização (a cada hora).
- **Data**: a data da movimentação (dd/mm/aaaa).
- **Tipo**: `Entrada`, `Saída` ou `Estorno`.
- **Categoria**: escolha da lista (aba `Categorias`).
- **Valor**: sempre positivo. O Tipo diz se o dinheiro entrou ou saiu.
- **Estorno de**: só para estornos, com o ID da transação que está sendo desfeita.

> Como toda linha completa da aba consolidada é lançada, só leve uma linha para lá quando ela estiver **conferida**. Rascunhos ficam nas abas de dados brutos.

## O ID é um elo de corrente

Cada ID (por exemplo `T-a3f9c21b7e04d5f6`) é calculado a partir de **data, descrição, tipo, categoria, valor e estorno** da linha **e do ID da transação anterior**, como os blocos de uma blockchain:

```
T-1 = hash(conteúdo da 1ª linha)
T-2 = hash(conteúdo da 2ª linha + T-1)
T-3 = hash(conteúdo da 3ª linha + T-2)
```

Por isso:
- Ninguém consegue "fabricar" um ID válido: ele só existe se o sistema o registrou.
- O sistema guarda uma cópia de cada transação. Se uma linha mudar, ele sabe **exatamente qual** foi e o que mudou.
- Se alguém mexer no próprio banco, a corrente quebra a partir da transação adulterada, e a verificação aponta onde.

A ordem da corrente é a ordem de **lançamento**, não a data da movimentação. Lançar hoje um gasto de mês passado é normal: ele entra no fim da corrente com a data certa.

## Regra de ouro

> **Depois que uma linha recebe ID, ela não pode mais ser alterada nem apagada.**

Qualquer mudança numa linha com ID gera um alerta para a diretoria. O site continua mostrando o valor original.

## Como corrigir um erro

Lançou R$ 120,50, mas eram R$ 102,50?

1. Crie uma linha nova: Tipo **Estorno**, mesmo valor da original (120,50), "Estorno de" = ID da original (copie e cole).
2. Crie outra linha com o valor correto (102,50).

No site aparecem as duas operações, e o saldo fica certo. Uma transação só pode ser estornada uma vez, e o estorno precisa ter exatamente o valor da original.

## O que gera alerta no Telegram

| Situação | Exemplo |
|---|---|
| Linha com ID alterada | Mudar o valor de 120,50 para 12,00 numa linha que já tem ID |
| Linha com ID apagada | Excluir uma linha que já tem ID |
| ID que o sistema nunca criou | Digitar ou colar um ID inventado |
| ID repetido | Copiar e colar uma linha que já tem ID |
| Linha nova com erro | Data inválida, valor vazio, tipo desconhecido |
| Falha na atualização | Planilha inacessível, permissão removida |

Se a linha for restaurada exatamente como estava, o alerta é encerrado e a diretoria recebe a confirmação.

## Configuração da aba consolidada (feita uma vez)

1. Crie a aba `Transações` com o cabeçalho acima na linha 1, e a aba `Categorias` (uma categoria por linha na coluna A).
2. **Tipo** (coluna D): Dados → Validação → Lista de itens: `Entrada,Saída,Estorno`.
3. **Categoria** (coluna E): Dados → Validação → Lista de um intervalo: `Categorias!A:A`.
4. **Data** (coluna B): Formatar → Número → Data.
5. **Proteja a coluna A**: Dados → Proteger páginas e intervalos → `Transações!A:A` → só você e a conta de serviço podem editar.
6. Compartilhe a planilha como **Editor** com o e-mail da conta de serviço (ver [configuracao.md](configuracao.md)).

Se a aba consolidada tiver outro nome, ajuste `SHEET_ABA` em `apps/etl/wrangler.jsonc`.
