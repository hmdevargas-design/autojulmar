-- Migração 005 — Código de identificação rápida de cliente
-- Permite associar um alias curto a um cliente (ex: "c12", "miguel")

alter table clientes
  add column if not exists codigo text;

-- Único por tenant (ignora NULLs — clientes sem código não conflituam)
create unique index if not exists idx_clientes_codigo
  on clientes (tenant_id, lower(codigo))
  where codigo is not null;
