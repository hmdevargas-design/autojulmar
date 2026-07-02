-- Configuração editável da mensagem de pedido pronto para levantamento.
-- Guardada em campos_definicao para reaproveitar a configuração multi-tenant já existente.
with alvo as (
  select id from tenants where slug = 'autojulmar'
)
insert into campos_definicao (
  tenant_id,
  nome,
  label,
  tipo,
  opcoes,
  obrigatorio,
  ordem,
  activo,
  e_variavel_preco,
  papel_preco
)
select
  alvo.id,
  'mensagem_pedido_pronto',
  'Mensagem: Pedido pronto',
  'textarea',
  '[{"valor":"corpo","label":"Olá {primeiroNome}! O seu pedido *#{numeroPedido}*{tipoTapete} está pronto para levantamento. Obrigado — {lojaNome} 🎉","ordem":1,"activo":true}]'::jsonb,
  false,
  900,
  false,
  false,
  null
from alvo
on conflict (tenant_id, nome) do update
set
  label = excluded.label,
  tipo = excluded.tipo,
  opcoes = case
    when campos_definicao.opcoes = '[]'::jsonb then excluded.opcoes
    else campos_definicao.opcoes
  end,
  obrigatorio = false,
  ordem = 900,
  activo = false,
  e_variavel_preco = false,
  papel_preco = null;
