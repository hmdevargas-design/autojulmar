-- ============================================================
-- Migração 003 — Seed do template Automóvel (tapetes)
-- Cria tenant demo + toda a configuração do MVP
-- ============================================================

-- Tenant demo
insert into tenants (id, nome, slug, cor_primaria, template_id, plano)
values (
  '00000000-0000-0000-0000-000000000001',
  'Tapetes Auto Demo',
  'demo',
  '#2563eb',
  'automovel',
  'pro'
) on conflict (slug) do nothing;

-- Tipos de cliente
insert into tipos_cliente (tenant_id, nome, desconto_pct, usa_tabela_propria, ordem)
values
  ('00000000-0000-0000-0000-000000000001', 'NORMAL',      0,  false, 1),
  ('00000000-0000-0000-0000-000000000001', 'STD/LJ/OFI',  15, false, 2),
  ('00000000-0000-0000-0000-000000000001', 'TAXI/TVDE',   20, true,  3),
  ('00000000-0000-0000-0000-000000000001', 'INTERNET',    5,  false, 4),
  ('00000000-0000-0000-0000-000000000001', 'ORÇAMENTO',   0,  false, 5),
  ('00000000-0000-0000-0000-000000000001', 'WORTEN',      0,  true,  6),
  ('00000000-0000-0000-0000-000000000001', 'AMAZON',      0,  true,  7)
on conflict (tenant_id, nome) do nothing;

-- Estados do fluxo
insert into estados_fluxo (tenant_id, nome, ordem, cor, is_final)
values
  ('00000000-0000-0000-0000-000000000001', 'Novo',        1, '#64748b', false),
  ('00000000-0000-0000-0000-000000000001', 'Em produção', 2, '#f59e0b', false),
  ('00000000-0000-0000-0000-000000000001', 'Pronto',      3, '#10b981', false),
  ('00000000-0000-0000-0000-000000000001', 'Entregue',    4, '#6366f1', true)
on conflict (tenant_id, nome) do nothing;

-- Campos de definição — template Automóvel
insert into campos_definicao (tenant_id, nome, label, tipo, opcoes, obrigatorio, ordem, e_variavel_preco, papel_preco)
values
  -- 1. Matrícula (lookup)
  ('00000000-0000-0000-0000-000000000001',
   'matricula', 'Matrícula', 'lookup_matricula', '[]', true, 1, false, null),

  -- 2. Viatura (preenchida pelo lookup)
  ('00000000-0000-0000-0000-000000000001',
   'viatura', 'Viatura', 'texto', '[]', false, 2, false, null),

  -- 3. Ano
  ('00000000-0000-0000-0000-000000000001',
   'ano', 'Ano', 'numero', '[]', false, 3, false, null),

  -- 4. Material (campo1 tabela base)
  ('00000000-0000-0000-0000-000000000001',
   'material', 'Material', 'select',
   '[
     {"valor":"ECO PRETO","label":"ECO PRETO","ordem":1,"activo":true},
     {"valor":"CINZA CABRIO","label":"CINZA CABRIO","ordem":2,"activo":true},
     {"valor":"GTI PRETO","label":"GTI PRETO","ordem":3,"activo":true},
     {"valor":"GTI CINZA","label":"GTI CINZA","ordem":4,"activo":true},
     {"valor":"VELUDO PRETO","label":"VELUDO PRETO","ordem":5,"activo":true},
     {"valor":"VELUDO CINZA","label":"VELUDO CINZA","ordem":6,"activo":true},
     {"valor":"BORRACHA","label":"BORRACHA","ordem":7,"activo":true},
     {"valor":"CANELADO","label":"CANELADO","ordem":8,"activo":true},
     {"valor":"OUTROS","label":"OUTROS","ordem":9,"activo":true},
     {"valor":"CAPAS","label":"CAPAS","ordem":10,"activo":true},
     {"valor":"REPARAÇÃO","label":"REPARAÇÃO","ordem":11,"activo":true},
     {"valor":"CHUVENTOS","label":"CHUVENTOS","ordem":12,"activo":true},
     {"valor":"TAPETES","label":"TAPETES","ordem":13,"activo":true}
   ]',
   true, 4, true, 'base_campo1'),

  -- 5. Tipo tapete (campo2 tabela base)
  ('00000000-0000-0000-0000-000000000001',
   'tipo_tapete', 'Tipo Tapete', 'multiselect',
   '[
     {"valor":"JOGO","label":"JOGO","ordem":1,"activo":true},
     {"valor":"JOGO EM 3","label":"JOGO EM 3","ordem":2,"activo":true},
     {"valor":"JOGO EM 4","label":"JOGO EM 4","ordem":3,"activo":true},
     {"valor":"JOGO EM 5","label":"JOGO EM 5","ordem":4,"activo":true},
     {"valor":"FRENTES","label":"FRENTES","ordem":5,"activo":true},
     {"valor":"FRENTE COMERCIAL","label":"FRENTE COMERCIAL","ordem":6,"activo":true},
     {"valor":"MALA","label":"MALA","ordem":7,"activo":true},
     {"valor":"3º","label":"3º","ordem":8,"activo":true},
     {"valor":"CONDUTOR","label":"CONDUTOR","ordem":9,"activo":true},
     {"valor":"TRASEIRO","label":"TRASEIRO","ordem":10,"activo":true},
     {"valor":"TRASEIRO INTEIRO","label":"TRASEIRO INTEIRO","ordem":11,"activo":true},
     {"valor":"TRÁS EM 3","label":"TRÁS EM 3","ordem":12,"activo":true},
     {"valor":"PENDURA","label":"PENDURA","ordem":13,"activo":true},
     {"valor":"TECIDO DAIANA","label":"TECIDO DAIANA","ordem":14,"activo":true},
     {"valor":"TAP VIGUESA","label":"TAP VIGUESA","ordem":15,"activo":true},
     {"valor":"REITAPETES","label":"REITAPETES","ordem":16,"activo":true},
     {"valor":"OUTROS","label":"OUTROS","ordem":17,"activo":true}
   ]',
   true, 5, true, 'base_campo2'),

  -- 6. Extras
  ('00000000-0000-0000-0000-000000000001',
   'extras', 'Extras', 'multiselect',
   '[
     {"valor":"reforço borracha","label":"Reforço Borracha","ordem":1,"activo":true},
     {"valor":"reforço alcatifa","label":"Reforço Alcatifa","ordem":2,"activo":true},
     {"valor":"molas condutor","label":"Molas Condutor","ordem":3,"activo":true},
     {"valor":"molas pendura","label":"Molas Pendura","ordem":4,"activo":true},
     {"valor":"velcro","label":"Velcro","ordem":5,"activo":true},
     {"valor":"sem reforço","label":"Sem Reforço","ordem":6,"activo":true},
     {"valor":"Ilhoses","label":"Ilhoses","ordem":7,"activo":true},
     {"valor":"Debrum em Lã","label":"Debrum em Lã","ordem":8,"activo":true}
   ]',
   false, 6, true, 'extra'),

  -- 7. Mais info
  ('00000000-0000-0000-0000-000000000001',
   'mais_info', 'Mais Info', 'textarea', '[]', false, 7, false, null),

  -- 8. Forma de pagamento
  ('00000000-0000-0000-0000-000000000001',
   'forma_pagamento', 'Forma de Pagamento', 'select',
   '[
     {"valor":"PAGO","label":"PAGO","ordem":1,"activo":true},
     {"valor":"PAGAR_NA_ENTREGA","label":"PAGAR NA ENTREGA","ordem":2,"activo":true},
     {"valor":"ENVIO_A_COBRANCA","label":"ENVIO A COBRANÇA","ordem":3,"activo":true},
     {"valor":"TRANSFERENCIA","label":"TRANSFERÊNCIA","ordem":4,"activo":true}
   ]',
   true, 8, false, null)
on conflict (tenant_id, nome) do nothing;

-- Tabela de preços base — amostra real do template Automóvel
-- (valores ilustrativos — o admin pode editar na Fase 2)
insert into tabela_preco_base (tenant_id, campo1_valor, campo2_valor, preco)
values
  -- ECO PRETO
  ('00000000-0000-0000-0000-000000000001', 'ECO PRETO', 'JOGO',              24.00),
  ('00000000-0000-0000-0000-000000000001', 'ECO PRETO', 'JOGO EM 3',         21.00),
  ('00000000-0000-0000-0000-000000000001', 'ECO PRETO', 'JOGO EM 4',         26.00),
  ('00000000-0000-0000-0000-000000000001', 'ECO PRETO', 'FRENTES',           14.00),
  ('00000000-0000-0000-0000-000000000001', 'ECO PRETO', 'CONDUTOR',           9.00),
  -- GTI PRETO
  ('00000000-0000-0000-0000-000000000001', 'GTI PRETO', 'JOGO',              42.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI PRETO', 'JOGO EM 3',         38.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI PRETO', 'JOGO EM 4',         58.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI PRETO', 'FRENTES',           32.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI PRETO', 'CONDUTOR',          18.00),
  -- GTI CINZA
  ('00000000-0000-0000-0000-000000000001', 'GTI CINZA', 'JOGO',              44.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI CINZA', 'JOGO EM 4',         60.00),
  ('00000000-0000-0000-0000-000000000001', 'GTI CINZA', 'FRENTES',           34.00),
  -- VELUDO PRETO
  ('00000000-0000-0000-0000-000000000001', 'VELUDO PRETO', 'JOGO',           48.00),
  ('00000000-0000-0000-0000-000000000001', 'VELUDO PRETO', 'FRENTES',        28.00),
  -- BORRACHA
  ('00000000-0000-0000-0000-000000000001', 'BORRACHA', 'JOGO',               35.00),
  ('00000000-0000-0000-0000-000000000001', 'BORRACHA', 'FRENTES',            20.00)
on conflict (tenant_id, campo1_valor, campo2_valor) do nothing;

-- Tabela de preços extra
insert into tabela_preco_extra (tenant_id, campo_nome, opcao_valor, preco_adicional)
values
  ('00000000-0000-0000-0000-000000000001', 'extras', 'reforço borracha', 3.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'reforço alcatifa', 3.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'molas condutor',   4.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'molas pendura',    4.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'velcro',           2.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'Ilhoses',          5.00),
  ('00000000-0000-0000-0000-000000000001', 'extras', 'Debrum em Lã',     6.00)
on conflict (tenant_id, campo_nome, opcao_valor) do nothing;
