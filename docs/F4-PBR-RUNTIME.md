# F4 — PBR runtime

## Objetivo

Aplicar materiais PBR oficiais da Biblioteca KARV ao GLB canônico sem acoplar regras de material à UI, sem acessar internals do renderer e sem alterar a geometria oficial.

## Contrato de produção

Um material entra no caminho PBR somente quando o catálogo público o declara `pbr_ready: true` e fornece:

- Base Color;
- Normal;
- AO;
- integridade SHA-256, dimensões e bytes de cada asset;
- referência física em centímetros;
- roughness explícito;
- `metalness = 0`;
- Normal em convenção OpenGL;
- strength de Normal e AO compatível com o runtime.

Materiais publicados sem PBR completo continuam disponíveis para descoberta/preview, mas não podem ser aplicados como PBR de produção.

## Escala física

A Biblioteca descreve o tamanho físico da amostra como `widthM × heightM` após conversão de centímetros para metros. Cada superfície configurável possui `texture_frame.meters_per_uv_unit` no contrato canônico.

A transformação usada pelo sampler é:

```text
repeatU = metersPerUvUnit / materialWidthM
repeatV = metersPerUvUnit / materialHeightM
```

`flip_u`, `flip_v` e `rotation_degrees` também vêm exclusivamente do `surface-map`. Nenhuma regra de escala, rotação ou inversão vive em React/UI ou depende do nome do tecido.

Consequência: o mesmo tecido mantém dimensão física coerente mesmo quando superfícies distintas possuem densidades UV diferentes.

## Carregamento progressivo

O catálogo e previews permanecem na F3. Base Color, Normal e AO só são solicitados quando o usuário efetivamente aplica um material PBR.

O `PbrMaterialController` prepara o conjunto completo antes de alterar a cena. A configuração lógica só é atualizada pelo Core após a aplicação visual ter sido concluída com sucesso.

`applyAll()` é atômico no nível do runtime: se uma superfície falhar, as superfícies já alteradas são restauradas ao estado anterior e as novas referências de textura são liberadas.

## Cache e budgets

Budgets definidos antes do gate F4:

- Biblioteca: no máximo **3,5 MiB** de Base Color + Normal + AO por material PBR web;
- runtime: **3 texturas ativas por superfície** configurada;
- cache: no máximo **6 texturas ociosas** mantidas para reaplicação rápida;
- uma combinação asset + transformação física possui uma chave determinística de cache;
- loads concorrentes da mesma chave compartilham a mesma Promise;
- substituição, reset e dispose liberam leases lógicos;
- entradas ociosas excedentes são podadas por LRU.

O Scene Graph público do `<model-viewer>` não fornece um `dispose()` público de Texture. A F4 não acessa internals Three.js: restaura/remove as referências dos canais públicos, elimina referências do cache da aplicação e mantém o número de objetos referenciados pelo runtime explicitamente limitado.

## Parâmetros suportados

A primeira versão F4 aceita:

- Normal OpenGL;
- `normal_strength = 1`;
- `ao_strength = 1`;
- roughness arbitrário entre 0 e 1 vindo do contrato;
- `metalness = 0`.

Strength diferente de 1 é rejeitado de forma controlada enquanto a Scene Graph pública usada pelo projeto não fornecer um setter estável para esses parâmetros. O runtime não simula esses valores nem usa APIs privadas.

## Reset e reversibilidade

- reset por superfície restaura as texturas baseline capturadas do GLB;
- reset geral restaura todas as superfícies e limpa entradas ociosas;
- dispose restaura textura e aparência baseline antes de liberar leases;
- aplicação diagnóstica F2 primeiro remove o PBR da superfície/escopo e então aplica o material escalar.

## Gate F4

A validação deve demonstrar:

1. Base Color, Normal e AO presentes no material real do `<model-viewer>`;
2. roughness e metalness aplicados conforme contrato;
3. escala física derivada do mesmo contrato em múltiplas superfícies;
4. cache hit ao reaplicar a mesma combinação, sem novo request de textura;
5. trocas repetidas respeitando os budgets de cache;
6. rollback e reset sem deixar configuração lógica parcialmente aplicada;
7. F0–F3, mouse e touch continuam verdes.
