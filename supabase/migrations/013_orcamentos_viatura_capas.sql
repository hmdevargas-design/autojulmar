-- ============================================================
-- Migração 013 - Orçamentos: viatura e categoria Capas
-- ============================================================

update orcamentos
set categoria = 'capas'
where categoria = 'copas';

alter table orcamentos
  drop constraint if exists orcamentos_categoria_check;

alter table orcamentos
  add constraint orcamentos_categoria_check
  check (categoria in ('reparacao','capas','outros'));
