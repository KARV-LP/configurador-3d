# Core 3D — F2

## Objetivo

A F2 transforma o viewer da F1 em um motor de configuração consultável por API interna, sem colocar regras de geometria, nomes técnicos ou escala de textura dentro da UI.

## Responsabilidades

- `SurfaceRegistry`: resolve `surface_id` público para bindings técnicos do contrato F0.
- `SelectionController`: converte hit-testing do viewer em seleção pública `configurable`, `fixed` ou `none`.
- `CameraController`: deriva enquadramento e limites diretamente de `surface-map.json`.
- `MaterialController`: aplica aparência, mantém baseline, highlight reversível e reset.
- `ConfigurationStore`: mantém assignments somente das superfícies configuráveis e não depende de React/DOM.
- `Core3DController`: orquestra seleção, aplicação por peça/todas, reset e leitura do estado.
- `ModelViewerAdapter`: concentra a integração com a Scene Graph API pública do `<model-viewer>`.

## Derivação runtime do GLB

O GLB canônico de F0 permanece imutável em `assets/geometry/karv-chair/v2/base.glb` e continua validado por hash.

Dois bindings configuráveis compartilham um único material no arquivo de origem e o contrato F0 marca esses bindings com `requires_material_instance: true`. Como o hit-testing público do `<model-viewer>` retorna o material atingido, a F2 gera no build/dev uma derivação determinística em `assets/runtime/karv-chair/v2/base.glb`.

A derivação:

1. lê o JSON do GLB canônico;
2. duplica apenas definições de material para bindings marcados pelo contrato;
3. atribui nomes runtime baseados no `surface_id` público;
4. redireciona somente o índice de material das primitives afetadas;
5. preserva buffers, Draco, topologia, posições, índices e UVs sem alteração.

O asset canônico nunca é sobrescrito. Mudanças futuras no contrato ou na geometria refazem a derivação automaticamente.

## Materiais de diagnóstico

`src/materials/runtime-material.ts` contém duas aparências simples usadas apenas para validar o Core F2. Elas não representam a Biblioteca KARV nem o pipeline PBR final. F3/F4 substituem essa fonte por materiais publicados e PBR reais sem mudar a API central de configuração.

## UI mínima

O painel visível nesta fase é apenas um harness de validação para provar:

- seleção por mouse/touch;
- rejeição de partes fixas;
- aplicação por peça;
- aplicação global;
- reset por peça/global;
- leitura do estado interno.

A interface definitiva pertence à F5.

## Gate

```bash
npm run format:check
npm run lint
npm run guard
npm test
npm run build
npm run budget
npm run e2e
```

A F2 só está apta para revisão quando o conjunto completo permanece verde e o smoke do navegador continua sem requests externas ou erros de console.
