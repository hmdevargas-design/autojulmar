-- ============================================================
-- Migração 012 - Orçamentos
-- Entidade própria para propostas e acompanhamento comercial
-- ============================================================

create table if not exists orcamentos (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  cliente_id       uuid not null references clientes(id),
  numero_orcamento int not null,
  estado           text not null default 'rascunho'
                   check (estado in ('rascunho','enviado','em_acompanhamento','aprovado','recusado','convertido')),
  categoria        text not null
                   check (categoria in ('reparacao','copas','outros')),
  produto          text not null,
  descricao        text,
  dados            jsonb not null default '{}'::jsonb,
  valor_estimado   numeric(10,2) not null default 0 check (valor_estimado >= 0),
  validade_em      date,
  origem           text not null default 'web'
                   check (origem in ('web','whatsapp','api')),
  criado_por       uuid not null default '00000000-0000-0000-0000-000000000001',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (tenant_id, numero_orcamento)
);

create table if not exists sequencia_orcamentos (
  tenant_id     uuid primary key references tenants(id) on delete cascade,
  ultimo_numero int not null default 999
);

create or replace function proximo_numero_orcamento(p_tenant_id uuid)
returns int
language plpgsql
as $$
declare
  v_numero int;
begin
  insert into sequencia_orcamentos (tenant_id, ultimo_numero)
  values (p_tenant_id, 1000)
  on conflict (tenant_id) do update
    set ultimo_numero = sequencia_orcamentos.ultimo_numero + 1
  returning ultimo_numero into v_numero;
  return v_numero;
end;
$$;

create index if not exists idx_orcamentos_tenant_id on orcamentos(tenant_id);
create index if not exists idx_orcamentos_cliente_id on orcamentos(cliente_id);
create index if not exists idx_orcamentos_estado on orcamentos(tenant_id, estado);
create index if not exists idx_orcamentos_categoria on orcamentos(tenant_id, categoria);
create index if not exists idx_orcamentos_criado_em on orcamentos(criado_em desc);

alter table orcamentos enable row level security;
alter table sequencia_orcamentos enable row level security;

drop policy if exists "orcamentos_tenant" on orcamentos;
create policy "orcamentos_tenant" on orcamentos
  for all using (tenant_id = auth_tenant_id());

drop policy if exists "sequencia_orcamentos_tenant" on sequencia_orcamentos;
create policy "sequencia_orcamentos_tenant" on sequencia_orcamentos
  for all using (tenant_id = auth_tenant_id());

drop trigger if exists trg_orcamentos_atualizado_em on orcamentos;
create trigger trg_orcamentos_atualizado_em
  before update on orcamentos
  for each row execute function atualizar_timestamp();
