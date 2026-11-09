-- Prestação de contas: append-only ledger, divergences and ETL run log.
-- Money is stored in integer centavos. Dates are ISO yyyy-mm-dd.

CREATE TABLE transacoes (
  seq           INTEGER PRIMARY KEY,                -- 1, 2, 3… (id = 'T-' || printf('%06d', seq))
  id            TEXT    NOT NULL UNIQUE,            -- T-000001
  data          TEXT    NOT NULL,
  descricao     TEXT    NOT NULL,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('entrada', 'saida', 'estorno')),
  categoria     TEXT    NOT NULL,
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  estorno_de    TEXT    REFERENCES transacoes (id),
  impressao     TEXT    NOT NULL,                   -- sha256 of the fields without the id (matches a sheet row before the id is written)
  hash          TEXT    NOT NULL,                   -- sha256 of id + fields
  hash_cadeia   TEXT    NOT NULL,                   -- sha256(previous hash_cadeia + hash)
  lancada_em    TEXT    NOT NULL,                   -- ISO timestamp of ingestion
  CHECK ((tipo = 'estorno') = (estorno_de IS NOT NULL))
);

-- The ledger is append-only: block UPDATE and DELETE at the database level.
CREATE TRIGGER transacoes_sem_update BEFORE UPDATE ON transacoes
BEGIN SELECT RAISE(ABORT, 'transacoes é somente inserção'); END;

CREATE TRIGGER transacoes_sem_delete BEFORE DELETE ON transacoes
BEGIN SELECT RAISE(ABORT, 'transacoes é somente inserção'); END;

-- IDs inserted in the ledger whose write-back to the sheet has not been confirmed yet.
CREATE TABLE ids_pendentes_escrita (
  id TEXT PRIMARY KEY REFERENCES transacoes (id)
);

CREATE TABLE divergencias (
  chave          TEXT PRIMARY KEY,                  -- deterministic key; the same problem keeps the same key
  tipo           TEXT NOT NULL CHECK (tipo IN ('alterada', 'apagada', 'id_desconhecido', 'id_duplicado', 'invalida')),
  id_transacao   TEXT,                              -- null for rows without a valid id
  linha_planilha INTEGER,                           -- sheet row number when detected
  detalhe        TEXT NOT NULL,                     -- human-readable explanation
  snapshot       TEXT,                              -- JSON of the sheet row as seen
  detectada_em   TEXT NOT NULL,
  notificada_em  TEXT,
  resolvida_em   TEXT
);

CREATE INDEX divergencias_abertas ON divergencias (resolvida_em);

CREATE TABLE execucoes_etl (
  id                INTEGER PRIMARY KEY,
  iniciada_em       TEXT NOT NULL,
  concluida_em      TEXT,
  status            TEXT NOT NULL CHECK (status IN ('sucesso', 'erro')),
  linhas_lidas      INTEGER NOT NULL DEFAULT 0,
  novas             INTEGER NOT NULL DEFAULT 0,
  divergencias      INTEGER NOT NULL DEFAULT 0,
  erro              TEXT
);
