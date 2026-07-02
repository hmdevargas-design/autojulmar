-- Corrige a interpretacao da coluna "Traseiro" da tabela Julho/2026.
-- Na tabela enviada, "Traseiro" representa o conjunto esquerdo + direito.
-- No SaaS mantemos as duas pecas separadas para permitir empilhamento; cada lado
-- fica com 50% do valor da coluna original.

with alvo as (
  select id from tenants where slug = 'autojulmar'
),
base(tabela_preco, material, traseiro_lado) as (
  values
    ('balcao', 'Eco',        6.50),
    ('balcao', 'GTI',       10.00),
    ('balcao', 'Canelado',  13.00),
    ('balcao', 'Veludo',    13.00),
    ('balcao', 'Borracha',  13.00),

    ('revenda', 'Eco',       5.50),
    ('revenda', 'GTI',       7.50),
    ('revenda', 'Canelado', 10.50),
    ('revenda', 'Veludo',   10.50),
    ('revenda', 'Borracha', 10.50),

    ('frota_tvde', 'Eco',       6.00),
    ('frota_tvde', 'GTI',       8.50),
    ('frota_tvde', 'Canelado', 11.50),
    ('frota_tvde', 'Veludo',   11.50),
    ('frota_tvde', 'Borracha', 11.50)
),
linhas as (
  select
    alvo.id as tenant_id,
    case
      when base.tabela_preco = 'balcao' then base.material
      else '__tabela_preco:' || base.tabela_preco || '::' || base.material
    end as campo1_valor,
    lados.campo2_valor,
    base.traseiro_lado as preco
  from alvo
  cross join base
  cross join lateral (
    values
      ('TRASEIRO ESQUERDO'),
      ('TRASEIRO DIREITO')
  ) as lados(campo2_valor)
)
insert into tabela_preco_base (tenant_id, campo1_valor, campo2_valor, preco)
select tenant_id, campo1_valor, campo2_valor, preco from linhas
on conflict (tenant_id, campo1_valor, campo2_valor)
do update set preco = excluded.preco;
