# Arquitetura canônica — F0

Status: contrato v1 proposto para aprovação no gate F0.

Este documento fixa a fronteira entre geometria, materiais, configuração,
experiência 3D, RA e UI. O objetivo da F0 é uma base versionável suficiente para
iniciar a F1; alterações futuras devem criar nova versão de contrato, não
reescrever silenciosamente uma versão publicada.

## Fontes de verdade

| Domínio      | Fonte de verdade                    | Regra                                                                                     |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Geometria    | `base.manifest.json` + GLB imutável | `geometry_version` muda quando topologia, UV, nomes técnicos, dimensões ou bindings mudam |
| Superfícies  | `contracts/surface-map.json`        | A identidade pública é `surface_id`; mesh/material são detalhes internos                  |
| Materiais    | `KARV-LP/karv-material-library`     | O configurador consome somente metadata pública validada                                  |
| Configuração | `configuration.schema.json`         | Estado completo é serializável sem React, DOM ou câmera                                   |
| RA/QR        | configuração canônica validada      | Desktop, mobile e RA restauram a mesma geometria e assignments                            |

O catálogo visual local não é fonte de produção. Fornecedor, custo, código
interno e metadata privada não entram em schema, payload, bundle ou UI pública.

## Estrutura inicial

```text
assets/geometry/karv-chair/v2/
  base.glb
  base.manifest.json
contracts/
  surface-map.json
  examples/
docs/
  adr/
schemas/
scripts/
```

A F1 adicionará os módulos de aplicação (`domain`, `3d`, `materials`, `ar` e
`ui`) sem mover regras de domínio para componentes visuais.

## Geometria canônica

- ID estável: `karv-chair`.
- Versão inicial desta REPO: `geometry_version = 2`.
- Unidade: metro, sistema destro, `+Y` para cima e frente em `-Z`.
- Asset: glTF 2.0 binário com `KHR_draco_mesh_compression` obrigatório.
- Hash canônico: SHA-256 dos bytes exatos do GLB.
- Dimensões do bounding box: 0,762338 m (X) × 0,737581 m (Y) × 0,818964 m (Z).
- O arquivo de uma versão publicada é imutável. Qualquer substituição de bytes
  exige novo hash; mudanças geométricas ou de UV exigem nova
  `geometry_version`.

Uma configuração referencia ID, versão e hash. Um runtime nunca deve abrir uma
configuração contra outro GLB apenas porque o nome do arquivo é igual.

## Registro de superfícies

O binding interno é a tupla `(mesh_name, primitive_index, material_name)`. A UI
recebe apenas `surface_id`, `public_name`, grupo e capacidade de configuração.

| `surface_id`      | Nome público          | Classificação |
| ----------------- | --------------------- | ------------- |
| `seat`            | Assento               | configurável  |
| `backrest-front`  | Frente do encosto     | configurável  |
| `backrest-side`   | Lateral do encosto    | configurável  |
| `backrest-rear`   | Traseira do encosto   | configurável  |
| `side-outer`      | Lateral externa       | configurável  |
| `side-inner`      | Lateral interna       | configurável  |
| `side-rear`       | Traseira das laterais | configurável  |
| `side-top`        | Topo das laterais     | configurável  |
| `piping-seat`     | Vivo do assento       | configurável  |
| `piping-backrest` | Vivo do encosto       | configurável  |
| `feet`            | Pés                   | fixa          |

Os dois vivos usam o mesmo material técnico `VIVO` no GLB. O Core 3D deve criar
instâncias independentes por mesh antes de aplicar assignments diferentes. A
identidade nunca pode ser apenas o nome do material.

Superfícies fixas são consultáveis para hit testing e acessibilidade, mas
rejeitam aplicação de tecido. Uma tentativa deve retornar erro de domínio
controlado, não alterar o GLB.

## Escala e orientação de textura

Cada superfície configurável possui `texture_frame`, fora da UI, com:

- UV set e nome;
- rotação em quartos de volta;
- espelhamento U/V;
- metros físicos por unidade UV;
- método e status de calibração.

Os valores v1 foram derivados do GLB por razão de áreas e são baseline
determinística. Materiais direcionais só recebem status visual definitivo após
aprovação com padrão de calibração; a aprovação muda
`calibration_status` para `visual-approved` e, se alterar o resultado público,
gera nova versão do contrato.

## Câmera

O contrato de câmera fica junto ao `surface-map`, pois depende das dimensões da
geometria:

- target: centro do bounding box;
- órbita inicial: azimute 0°, polar 75°, raio 1,6 m;
- polar permitido: 35° a 90°;
- raio de segurança: 0,9 m a 3 m;
- FOV: 30°;
- zoom e rotação automática desabilitados por padrão.

A UI pode oferecer comandos sem ultrapassar esses limites. Ela não recalcula
enquadramento por CSS nem guarda valores próprios por breakpoint.

## Configuração de domínio

Uma configuração completa contém:

1. `schema_version`;
2. ID, versão e hash da geometria;
3. um assignment `surface_id → material_id` para cada superfície configurável.

Câmera, painel aberto, hover e posição do QR são estado efêmero de experiência e
não fazem parte da configuração do produto. O validador combina schema e
`surface-map` para exigir cobertura completa e impedir assignments em partes
fixas.

## Fronteiras dos módulos da F1/F2

- `domain`: configuração, IDs, erros e validação; sem DOM.
- `3d`: carregamento, seleção, câmera e binding técnico.
- `materials`: catálogo público, cache e assets PBR.
- `ar`: compatibilidade, serialização e handoff.
- `ui`: apresentação e comandos; nunca conhece mesh, material técnico ou UV.

Dependências fluem da UI para APIs de domínio. Nenhum módulo de domínio importa
React ou `<model-viewer>`.

## Política de versão

| Mudança                                               | Ação                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Bytes diferentes sem mudança geométrica               | novo hash e revisão documentada; não sobrescrever asset publicado |
| Topologia, UV, dimensões, mesh/material ou superfície | incrementar `geometry_version`                                    |
| Campo de schema compatível e opcional                 | revisão menor documentada                                         |
| Campo obrigatório, semântica ou formato incompatível  | nova `schema_version` e política de migração                      |
| Nome público                                          | pode evoluir sem mudar binding, desde que IDs permaneçam estáveis |

## Relação com o MVP `KARV-LP/3D`

| Preservar como requisito                                                                                         | Refazer na nova arquitetura                                                           | Descartar                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| poltrona oficial, seleção direta, aplicar por peça/todas, reset, resumo, direção Studio Premium e intenção de RA | estado de domínio, seleção, materiais PBR, biblioteca, UI desktop/mobile, QR e testes | cópia de `app/`, catálogo visual local como produção, estado acoplado ao DOM, nomes técnicos na UI e viewer crítico por CDN |

A decisão formal está em
[`adr/0001-clean-rebuild-without-mvp-app.md`](adr/0001-clean-rebuild-without-mvp-app.md).
