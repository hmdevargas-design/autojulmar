-- Adiciona a coluna "Frentes" da tabela corrigida de Julho/2026.
-- Frentes = Condutor + Pendura (par da frente).

with alvo as (
  select id from tenants where slug = 'autojulmar'
)
update campos_definicao
set opcoes = '[
  {"valor":"JOGO EM 4","label":"Jogo em 4","ordem":1,"activo":true},
  {"valor":"JOGO EM 3","label":"Jogo em 3","ordem":2,"activo":true},
  {"valor":"FRENTES","label":"Frentes","ordem":3,"activo":true},
  {"valor":"CONDUTOR","label":"Condutor","ordem":4,"activo":true},
  {"valor":"PENDURA","label":"Pendura","ordem":5,"activo":true},
  {"valor":"TRASEIRO ESQUERDO","label":"Traseiro esquerdo","ordem":6,"activo":true},
  {"valor":"TRASEIRO DIREITO","label":"Traseiro direito","ordem":7,"activo":true},
  {"valor":"TRASEIRO INTEIRO","label":"Traseiro inteiro","ordem":8,"activo":true},
  {"valor":"3º TAPETE","label":"3º tapete","ordem":9,"activo":true},
  {"valor":"CARRINHAS 7 LUGARES","label":"Carrinhas 7 lugares","ordem":10,"activo":true},
  {"valor":"FRENTE COMERCIAL","label":"Frente comercial","ordem":11,"activo":true}
]'::jsonb
where tenant_id in (select id from alvo)
  and nome = 'tipo_tapete';

with alvo as (
  select id from tenants where slug = 'autojulmar'
),
base(tabela_preco, material, frentes) as (
  values
    ('balcao', 'Eco',       22.00),
    ('balcao', 'GTI',       35.00),
    ('balcao', 'Canelado',  46.00),
    ('balcao', 'Veludo',    46.00),
    ('balcao', 'Borracha',  46.00),

    ('revenda', 'Eco',      19.00),
    ('revenda', 'GTI',      27.00),
    ('revenda', 'Canelado', 38.00),
    ('revenda', 'Veludo',   38.00),
    ('revenda', 'Borracha', 38.00),

    ('frota_tvde', 'Eco',       21.00),
    ('frota_tvde', 'GTI',       31.00),
    ('frota_tvde', 'Canelado',  41.00),
    ('frota_tvde', 'Veludo',    41.00),
    ('frota_tvde', 'Borracha',  41.00)
),
linhas as (
  select
    alvo.id as tenant_id,
    case
      when base.tabela_preco = 'balcao' then base.material
      else '__tabela_preco:' || base.tabela_preco || '::' || base.material
    end as campo1_valor,
    'FRENTES' as campo2_valor,
    base.frentes as preco
  from alvo
  cross join base
)
insert into tabela_preco_base (tenant_id, campo1_valor, campo2_valor, preco)
select tenant_id, campo1_valor, campo2_valor, preco from linhas
on conflict (tenant_id, campo1_valor, campo2_valor)
do update set preco = excluded.preco;
