-- Adiciona Tapetes 3D e Mala 3D à tabela de preços Autojulmar.
-- Valores internos seguem o vocabulário do agente WhatsApp.

with alvo as (
  select id from tenants where slug = 'autojulmar'
)
update campos_definicao
set opcoes =
  opcoes
  || case
    when opcoes @> '[{"valor":"TAPETES 3D"}]'::jsonb then '[]'::jsonb
    else '[{"valor":"TAPETES 3D","label":"Tapetes 3D","ordem":6,"activo":true}]'::jsonb
  end
  || case
    when opcoes @> '[{"valor":"MALAS 3D"}]'::jsonb then '[]'::jsonb
    else '[{"valor":"MALAS 3D","label":"Mala 3D","ordem":7,"activo":true}]'::jsonb
  end
where tenant_id in (select id from alvo)
  and nome = 'material';

with alvo as (
  select id from tenants where slug = 'autojulmar'
)
update campos_definicao
set opcoes =
  opcoes
  || case
    when opcoes @> '[{"valor":"MALA"}]'::jsonb then '[]'::jsonb
    else '[{"valor":"MALA","label":"Mala","ordem":12,"activo":true}]'::jsonb
  end
where tenant_id in (select id from alvo)
  and nome = 'tipo_tapete';

with alvo as (
  select id from tenants where slug = 'autojulmar'
),
linhas(tabela_preco, material, tipo_tapete, preco) as (
  values
    ('balcao', 'TAPETES 3D', 'JOGO EM 4', 89.00),
    ('revenda', 'TAPETES 3D', 'JOGO EM 4', 89.00),
    ('frota_tvde', 'TAPETES 3D', 'JOGO EM 4', 89.00),
    ('balcao', 'MALAS 3D', 'MALA', 65.00),
    ('revenda', 'MALAS 3D', 'MALA', 65.00),
    ('frota_tvde', 'MALAS 3D', 'MALA', 65.00)
),
precos as (
  select
    alvo.id as tenant_id,
    case
      when linhas.tabela_preco = 'balcao' then linhas.material
      else '__tabela_preco:' || linhas.tabela_preco || '::' || linhas.material
    end as campo1_valor,
    linhas.tipo_tapete as campo2_valor,
    linhas.preco
  from alvo
  cross join linhas
)
insert into tabela_preco_base (tenant_id, campo1_valor, campo2_valor, preco)
select tenant_id, campo1_valor, campo2_valor, preco from precos
on conflict (tenant_id, campo1_valor, campo2_valor)
do update set preco = excluded.preco;
