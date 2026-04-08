-- ============================================================
-- Migração 001 — Schema core da plataforma
-- Multi-tenant: todas as tabelas têm tenant_id
-- ============================================================

-- Extensão para UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TENANTS
-- ============================================================
create table if not exists tenants (
  id            uuid primary key default uuid_generate_v4(),
  nome          text not null,
  slug          text not null unique,
  logo_url      text,
  cor_primaria  text not null default '#2563eb',
  template_id   text not null default 'automovel',
  plano         text not null default 'basico'
                check (plano in ('gratuito', 'basico', 'pro', 'enterprise')),
  activo        boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============================================================
-- TIPOS DE CLIENTE
-- ============================================================
create table if not exists tipos_cliente (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  nome               text not null,
  desconto_pct       numeric(5,2) not null default 0
                     check (desconto_pct >= 0 and desconto_pct <= 100),
  usa_tabela_propria boolean not null default false,
  ordem              int not null default 0,
  activo             boolean not null default true,
  unique (tenant_id, nome)
);

-- ============================================================
-- ESTADOS DO FLUXO
-- ============================================================
create table if not exists estados_fluxo (
  id        uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  nome      text not null,
  ordem     int not null default 0,
  cor       text not null default '#64748b',
  is_final  boolean not null default false,
  unique (tenant_id, nome)
);

-- ============================================================
-- DEFINIÇÃO DE CAMPOS DINÂMICOS
-- ============================================================
create table if not exists campos_definicao (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  nome            text not null,
  label           text not null,
  tipo            text not null
                  check (tipo in ('texto','textarea','select','multiselect','numero','data','lookup_matricula')),
  opcoes          jsonb not null default '[]',
  obrigatorio     boolean not null default false,
  ordem           int not null default 0,
  activo          boolean not null default true,
  e_variavel_preco boolean not null default false,
  papel_preco     text check (papel_preco in ('base_campo1','base_campo2','extra','multiplicador')),
  unique (tenant_id, nome)
);

-- ============================================================
-- TABELA DE PREÇOS BASE
-- ============================================================
create table if not exists tabela_preco_base (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  campo1_valor text not null,
  campo2_valor text not null,
  preco        numeric(10,2) not null check (preco >= 0),
  unique (tenant_id, campo1_valor, campo2_valor)
);

-- ============================================================
-- TABELA DE PREÇOS EXTRA
-- ============================================================
create table if not exists tabela_preco_extra (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  campo_nome       text not null,
  opcao_valor      text not null,
  preco_adicional  numeric(10,2) not null check (preco_adicional >= 0),
  unique (tenant_id, campo_nome, opcao_valor)
);

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists clientes (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  nome             text not null,
  contacto         text not null,
  email            text,
  nif              text,
  tipo_cliente_id  uuid references tipos_cliente(id),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (tenant_id, contacto)
);

-- ============================================================
-- PEDIDOS
-- ============================================================
create table if not exists pedidos (
  id                 uuid primary key default uuid_generate_v4(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  cliente_id         uuid not null references clientes(id),
  numero_pedido      int not null,
  estado_id          uuid not null references estados_fluxo(id),
  dados              jsonb not null default '{}',
  preco_base         numeric(10,2) not null default 0,
  soma_extras        numeric(10,2) not null default 0,
  subtotal           numeric(10,2) not null default 0,
  desconto_tipo_pct  numeric(5,2) not null default 0,
  desconto_manual    numeric(10,2) not null default 0,
  valor_final        numeric(10,2) not null default 0,
  sinal              numeric(10,2) not null default 0,
  forma_pagamento    text not null default 'PAGAR_NA_ENTREGA'
                     check (forma_pagamento in ('PAGO','PAGAR_NA_ENTREGA','ENVIO_A_COBRANCA','TRANSFERENCIA')),
  documento_url      text,
  origem             text not null default 'web'
                     check (origem in ('web','whatsapp','api')),
  criado_por         uuid not null,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  unique (tenant_id, numero_pedido)
);

-- Sequência de numeração de pedidos por tenant
create table if not exists sequencia_pedidos (
  tenant_id       uuid primary key references tenants(id) on delete cascade,
  ultimo_numero   int not null default 1999
);

-- Função para obter próximo número de pedido
create or replace function proximo_numero_pedido(p_tenant_id uuid)
returns int
language plpgsql
as $$
declare
  v_numero int;
begin
  insert into sequencia_pedidos (tenant_id, ultimo_numero)
  values (p_tenant_id, 2000)
  on conflict (tenant_id) do update
    set ultimo_numero = sequencia_pedidos.ultimo_numero + 1
  returning ultimo_numero into v_numero;
  return v_numero;
end;
$$;

-- ============================================================
-- SESSÕES WHATSAPP (Fase 5)
-- ============================================================
create table if not exists sessoes_whatsapp (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  telefone         text not null,
  estado_conversa  jsonb not null default '{}',
  expira_em        timestamptz not null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (tenant_id, telefone)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_pedidos_tenant_id       on pedidos(tenant_id);
create index if not exists idx_pedidos_cliente_id      on pedidos(cliente_id);
create index if not exists idx_pedidos_estado_id       on pedidos(estado_id);
create index if not exists idx_pedidos_criado_em       on pedidos(criado_em desc);
create index if not exists idx_clientes_tenant_id      on clientes(tenant_id);
create index if not exists idx_clientes_contacto       on clientes(tenant_id, contacto);
create index if not exists idx_sessoes_telefone        on sessoes_whatsapp(tenant_id, telefone);
create index if not exists idx_sessoes_expira_em       on sessoes_whatsapp(expira_em);

-- ============================================================
-- TRIGGER: atualizado_em automático
-- ============================================================
create or replace function atualizar_timestamp()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger trg_tenants_atualizado_em
  before update on tenants
  for each row execute function atualizar_timestamp();

create trigger trg_clientes_atualizado_em
  before update on clientes
  for each row execute function atualizar_timestamp();

create trigger trg_pedidos_atualizado_em
  before update on pedidos
  for each row execute function atualizar_timestamp();

create trigger trg_sessoes_atualizado_em
  before update on sessoes_whatsapp
  for each row execute function atualizar_timestamp();
