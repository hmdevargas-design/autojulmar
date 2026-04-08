-- ============================================================
-- Migração 002 — Row Level Security (RLS)
-- Isolamento multi-tenant obrigatório em todas as tabelas
-- ============================================================

-- Activa RLS
alter table tenants              enable row level security;
alter table tipos_cliente        enable row level security;
alter table estados_fluxo        enable row level security;
alter table campos_definicao     enable row level security;
alter table tabela_preco_base    enable row level security;
alter table tabela_preco_extra   enable row level security;
alter table clientes             enable row level security;
alter table pedidos              enable row level security;
alter table sessoes_whatsapp     enable row level security;
alter table sequencia_pedidos    enable row level security;

-- ============================================================
-- Função auxiliar: tenant_id do utilizador autenticado
-- O tenant_id é guardado nos metadados do JWT (app_metadata)
-- ============================================================
create or replace function auth_tenant_id()
returns uuid
language sql stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

-- ============================================================
-- POLÍTICAS: utilizador só vê dados do seu tenant
-- ============================================================

-- Tenants: utilizador vê apenas o seu próprio tenant
create policy "tenant_isolamento_leitura" on tenants
  for select using (id = auth_tenant_id());

-- Tipos de cliente
create policy "tipos_cliente_tenant" on tipos_cliente
  for all using (tenant_id = auth_tenant_id());

-- Estados de fluxo
create policy "estados_fluxo_tenant" on estados_fluxo
  for all using (tenant_id = auth_tenant_id());

-- Campos de definição
create policy "campos_definicao_tenant" on campos_definicao
  for all using (tenant_id = auth_tenant_id());

-- Tabela preços base
create policy "tabela_preco_base_tenant" on tabela_preco_base
  for all using (tenant_id = auth_tenant_id());

-- Tabela preços extra
create policy "tabela_preco_extra_tenant" on tabela_preco_extra
  for all using (tenant_id = auth_tenant_id());

-- Clientes
create policy "clientes_tenant" on clientes
  for all using (tenant_id = auth_tenant_id());

-- Pedidos
create policy "pedidos_tenant" on pedidos
  for all using (tenant_id = auth_tenant_id());

-- Sessões WhatsApp
create policy "sessoes_whatsapp_tenant" on sessoes_whatsapp
  for all using (tenant_id = auth_tenant_id());

-- Sequência pedidos
create policy "sequencia_pedidos_tenant" on sequencia_pedidos
  for all using (tenant_id = auth_tenant_id());
