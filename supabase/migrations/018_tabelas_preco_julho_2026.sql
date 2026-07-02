-- Tabelas de preco Autojulmar - julho de 2026
-- Compatibilidade: usa a tabela_preco_base existente.
-- Balcao fica com material normal; Revenda/Frota usam prefixo interno no campo1_valor.

with alvo as (
  select id from tenants where slug = 'autojulmar'
)
update campos_definicao
set opcoes = '[
  {"valor":"Eco","label":"Eco","ordem":1,"activo":true},
  {"valor":"GTI","label":"GTI","ordem":2,"activo":true},
  {"valor":"Canelado","label":"Canelado","ordem":3,"activo":true},
  {"valor":"Veludo","label":"Veludo","ordem":4,"activo":true},
  {"valor":"Borracha","label":"Borracha","ordem":5,"activo":true}
]'::jsonb
where tenant_id in (select id from alvo)
  and nome = 'material';

with alvo as (
  select id from tenants where slug = 'autojulmar'
)
update campos_definicao
set opcoes = '[
  {"valor":"JOGO EM 4","label":"Jogo em 4","ordem":1,"activo":true},
  {"valor":"JOGO EM 3","label":"Jogo em 3","ordem":2,"activo":true},
  {"valor":"CONDUTOR","label":"Condutor","ordem":3,"activo":true},
  {"valor":"PENDURA","label":"Pendura","ordem":4,"activo":true},
  {"valor":"TRASEIRO ESQUERDO","label":"Traseiro esquerdo","ordem":5,"activo":true},
  {"valor":"TRASEIRO DIREITO","label":"Traseiro direito","ordem":6,"activo":true},
  {"valor":"TRASEIRO INTEIRO","label":"Traseiro inteiro","ordem":7,"activo":true},
  {"valor":"3º TAPETE","label":"3º tapete","ordem":8,"activo":true},
  {"valor":"CARRINHAS 7 LUGARES","label":"Carrinhas 7 lugares","ordem":9,"activo":true},
  {"valor":"FRENTE COMERCIAL","label":"Frente comercial","ordem":10,"activo":true}
]'::jsonb
where tenant_id in (select id from alvo)
  and nome = 'tipo_tapete';

with alvo as (
  select id from tenants where slug = 'autojulmar'
),
base(tabela_preco, material, jogo4, jogo3, condutor, pendura, traseiro, traseiro_inteiro, terceiro_tapete, carrinhas7, frente_comercial) as (
  values
    ('balcao', 'Eco',       35.00, 40.00, 13.00,  9.00, 13.00, 14.00, 11.00,  51.00, 33.00),
    ('balcao', 'GTI',       55.00, 63.00, 20.00, 15.00, 20.00, 23.00, 17.00,  80.00, 52.00),
    ('balcao', 'Canelado',  72.00, 82.00, 27.00, 19.00, 26.00, 30.00, 22.00, 104.00, 68.00),
    ('balcao', 'Veludo',    72.00, 82.00, 27.00, 19.00, 26.00, 30.00, 22.00, 104.00, 68.00),
    ('balcao', 'Borracha',  72.00, 82.00, 27.00, 19.00, 26.00, 30.00, 22.00, 104.00, 68.00),

    ('revenda', 'Eco',      30.00, 34.00, 11.00,  8.00, 11.00, 12.00,  9.00,  43.00, 29.00),
    ('revenda', 'GTI',      42.00, 48.00, 16.00, 11.00, 15.00, 17.00, 13.00,  61.00, 40.00),
    ('revenda', 'Canelado', 59.00, 67.00, 22.00, 16.00, 21.00, 24.00, 18.00,  85.00, 56.00),
    ('revenda', 'Veludo',   59.00, 67.00, 22.00, 16.00, 21.00, 24.00, 18.00,  85.00, 56.00),
    ('revenda', 'Borracha', 59.00, 67.00, 22.00, 16.00, 21.00, 24.00, 18.00,  85.00, 56.00),

    ('frota_tvde', 'Eco',       32.00, 36.00, 12.00,  9.00, 12.00, 13.00, 10.00, 46.00, 30.00),
    ('frota_tvde', 'GTI',       48.00, 55.00, 18.00, 13.00, 17.00, 20.00, 14.00, 69.00, 46.00),
    ('frota_tvde', 'Canelado',  64.00, 73.00, 24.00, 17.00, 23.00, 26.00, 19.00, 92.00, 61.00),
    ('frota_tvde', 'Veludo',    64.00, 73.00, 24.00, 17.00, 23.00, 26.00, 19.00, 92.00, 61.00),
    ('frota_tvde', 'Borracha',  64.00, 73.00, 24.00, 17.00, 23.00, 26.00, 19.00, 92.00, 61.00)
),
linhas as (
  select
    alvo.id as tenant_id,
    case
      when base.tabela_preco = 'balcao' then base.material
      else '__tabela_preco:' || base.tabela_preco || '::' || base.material
    end as campo1_valor,
    preco.campo2_valor,
    preco.preco
  from alvo
  cross join base
  cross join lateral (
    values
      ('JOGO EM 4', base.jogo4),
      ('JOGO EM 3', base.jogo3),
      ('CONDUTOR', base.condutor),
      ('PENDURA', base.pendura),
      ('TRASEIRO ESQUERDO', base.traseiro),
      ('TRASEIRO DIREITO', base.traseiro),
      ('TRASEIRO INTEIRO', base.traseiro_inteiro),
      ('3º TAPETE', base.terceiro_tapete),
      ('CARRINHAS 7 LUGARES', base.carrinhas7),
      ('FRENTE COMERCIAL', base.frente_comercial)
  ) as preco(campo2_valor, preco)
)
insert into tabela_preco_base (tenant_id, campo1_valor, campo2_valor, preco)
select tenant_id, campo1_valor, campo2_valor, preco from linhas
on conflict (tenant_id, campo1_valor, campo2_valor)
do update set preco = excluded.preco;

with alvo as (
  select id from tenants where slug = 'autojulmar'
),
extras(campo_nome, opcao_valor, preco_adicional) as (
  values
    ('extras', 'velcro', 5.00),
    ('extras', 'molas condutor', 2.50),
    ('extras', 'molas pendura', 2.50)
)
insert into tabela_preco_extra (tenant_id, campo_nome, opcao_valor, preco_adicional)
select alvo.id, extras.campo_nome, extras.opcao_valor, extras.preco_adicional
from alvo
cross join extras
on conflict (tenant_id, campo_nome, opcao_valor)
do update set preco_adicional = excluded.preco_adicional;
