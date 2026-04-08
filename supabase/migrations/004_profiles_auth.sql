-- ============================================================
-- Migração 004 — Profiles: liga utilizadores Auth a tenants
-- ============================================================

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  nome         text,
  role         text not null default 'operador'
               check (role in ('admin', 'operador')),
  criado_em    timestamptz not null default now()
);

alter table profiles enable row level security;

-- Utilizador vê apenas o seu próprio perfil
create policy "profiles_self" on profiles
  for select using (id = auth.uid());

-- Função auxiliar actualizada: lê tenant_id do profiles
-- (fallback para app_metadata para compatibilidade futura)
create or replace function auth_tenant_id()
returns uuid
language sql stable
as $$
  select coalesce(
    (select tenant_id from profiles where id = auth.uid()),
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  )
$$;

-- Insere perfil automaticamente quando utilizador regista
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- O tenant_id vem dos metadados de registo (raw_user_meta_data)
  insert into profiles (id, tenant_id, nome)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'tenant_id')::uuid,
    new.raw_user_meta_data ->> 'nome'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
