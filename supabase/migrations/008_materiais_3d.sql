-- Renomeia TAPETES para TAPETES 3D e adiciona MALAS 3D nos materiais

UPDATE campos_definicao
SET opcoes = (
  SELECT jsonb_agg(
    CASE
      WHEN (elem->>'valor') = 'TAPETES'
      THEN '{"valor":"TAPETES 3D","label":"TAPETES 3D","ordem":13,"activo":true}'::jsonb
      ELSE elem
    END
    ORDER BY (elem->>'ordem')::int
  ) || '[{"valor":"MALAS 3D","label":"MALAS 3D","ordem":14,"activo":true}]'::jsonb
  FROM jsonb_array_elements(opcoes) AS elem
)
WHERE nome = 'material'
  AND tenant_id = (SELECT id FROM tenants WHERE slug = 'autojulmar');
