-- ============================================================
-- Migracao 014 - Orcamentos: numeracao a partir de OR-0001
-- ============================================================

alter table sequencia_orcamentos
  alter column ultimo_numero set default 0;

update sequencia_orcamentos s
set ultimo_numero = coalesce((
  select max(o.numero_orcamento)
  from orcamentos o
  where o.tenant_id = s.tenant_id
), 0);

create or replace function proximo_numero_orcamento(p_tenant_id uuid)
returns int
language plpgsql
as $$
declare
  v_numero int;
begin
  insert into sequencia_orcamentos (tenant_id, ultimo_numero)
  values (p_tenant_id, 1)
  on conflict (tenant_id) do update
    set ultimo_numero = greatest(
      sequencia_orcamentos.ultimo_numero + 1,
      coalesce((
        select max(o.numero_orcamento) + 1
        from orcamentos o
        where o.tenant_id = p_tenant_id
      ), 1)
    )
  returning ultimo_numero into v_numero;

  return v_numero;
end;
$$;
