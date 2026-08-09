# Evidências de validação — F0

Data da auditoria: 2026-08-09.

## Entradas

- GLB recebido: 647.280 bytes.
- SHA-256 real: `878a8b89aa330da1dc7a4be00a5de6c0321ab1273c90c414ed1f22fc851df1bf`.
- glTF 2.0, gerado pelo Blender 5.2.39.
- Extensão obrigatória: `KHR_draco_mesh_compression`.

## Divergência corrigida

O manifesto de origem declarava
`6182726da1871f17c88fb8d48c3a51aa5c36d883453f333adc049dba2c62fa0e`,
que não corresponde aos bytes do GLB recebido, e marcava o asset como
`pending`. Ele também registrava contagens de vértices do Blender que não
coincidem em todas as peças com os accessors exportados.

O manifesto canônico usa o hash, tamanho e estatísticas lidos diretamente do
GLB. O arquivo de origem não foi publicado para evitar duas fontes de verdade.

## Estrutura verificada

| Métrica                   |                        Resultado |
| ------------------------- | -------------------------------: |
| Partes/meshes             |                               11 |
| Primitivas                |                               11 |
| Superfícies configuráveis |                               10 |
| Superfícies fixas         |                                1 |
| Vértices enviados         |                          144.781 |
| Triângulos                |                          245.118 |
| Dimensões X × Y × Z       | 0,762338 × 0,737581 × 0,818964 m |

Todas as tuplas mesh/material aparecem exatamente uma vez no
`surface-map.json`. `Material.012` fica confinado ao binding interno de
`side-top`; o nome público é `Topo das laterais`.

Os vivos do assento e do encosto compartilham o material técnico `VIVO`. Ambos
estão marcados com `requires_material_instance: true` para impedir aplicação
acoplada por engano.

## Escala UV

`meters_per_uv_unit` foi calculado por superfície configurável com:

```text
sqrt(área 3D em m² / área UV)
```

Os valores estão marcados como `derived`. A validação visual com padrão
direcional promove cada frame a `visual-approved`; isso é requisito antes de
liberar material direcional em produção.

## Comandos

```bash
npm ci
npm test
npx @gltf-transform/cli@4.2.1 validate assets/geometry/karv-chair/v2/base.glb
```

Resultado esperado do repositório: schemas válidos, hash/tamanho conferidos,
GLB parseável, cobertura integral de bindings e configuração de exemplo
completa. O validador glTF não reportou erro nem warning; informou apenas que a
extensão Draco não é inspecionada internamente e que UVs estão sem textura no
asset neutro.
