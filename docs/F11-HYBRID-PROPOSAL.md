# F11.3B — Proposta híbrida SID Tattoo · Tema 2 · P4

Branch `feat/f11-custom-proposals` · Issue #30 · PR #31 (Draft).

## Resultado implementado

A proposta `sid-tattoo-p4` usa exatamente as seis artes aprovadas como fontes e mantém o contrato de runtime `image/webp`. Os JPGs não são publicados. A conversão usa WebP quality 92/method 6, limite de 4096 px, sem crop, rotação ou alteração de proporção.

| Fonte aprovada | `surface_id` | WebP final | Resolução | Bytes |
| --- | --- | --- | ---: | ---: |
| `assento.jpg` | `seat` | `seat.webp` | 3548 × 2367 | 1.022.360 |
| `ENCOSTO_FRONTAL.jpg` | `backrest-front` | `backrest-front.webp` | 3074 × 4096 | 1.633.538 |
| `ENCOSTO_LATERAL.jpg` | `backrest-side` | `backrest-side.webp` | 1233 × 1253 | 283.488 |
| `ENCOSTO_TRASEIRO.jpg` | `backrest-rear` | `backrest-rear.webp` | 3074 × 4096 | 1.732.012 |
| `LATERAL_EXTERNA.jpg` | `side-outer` | `side-outer.webp` | 4096 × 2582 | 1.303.076 |
| `LATERAL_INTERNA.jpg` | `side-inner` | `side-inner.webp` | 2949 × 1047 | 403.370 |

Total dos seis WebPs: **6.377.844 bytes**. SHA-256, bytes, dimensões de origem/runtime, molde físico e regra de conversão estão em `docs/f11/sid-tattoo-p4-assets.json`.

## Moldes, referência e fallback oficial

Os seis moldes previamente auditados definem a associação e as dimensões físicas das artes. O molde adicional `LATERAL_TOP.pdf` confirma a existência de `side-top`, mas não há JPG aprovado para essa face; ele não foi transformado em estampa. `KARV-REFERENCIA.webp` foi usado somente para conferência visual da identidade/silhueta da poltrona e não é asset de runtime.

As superfícies sem arte suficiente usam o Revestimento oficial **Croma Musgo Pet Friendly**, `material_id: fabric-kv-002`, único item do catálogo auditado com PBR `production` completo:

- `side-rear`
- `side-top`
- `piping-seat`
- `piping-backrest`

O harness híbrido prepara esse fallback oficial antes de inicializar o baseline F11. Assim, a aplicação custom troca somente Base Color nas seis faces aprovadas, preserva Normal/AO/fatores/transform UV e mantém as quatro faces restantes com o PBR oficial. Referências custom não entram no F7; somente o `material_id` oficial das quatro faces é serializado.

## Integridade e regressão

- `contracts/examples/proposal.sid-tattoo-p4.json` registra somente os seis WebPs custom aprovados.
- O validador confere schema, cobertura 6 + 4, arquivos, bytes e SHA-256 reais.
- O E2E híbrido confere as seis substituições, as quatro atribuições oficiais, PBR, F7, reset, liberação e ausência de erros.
- Evidências frontal/traseira são salvas como `f11-hybrid-front.png` e `f11-hybrid-rear.png` no artifact de CI `f11-hybrid-evidence`.
- GLB, UVs, bindings, `surface-map`, F7 e caminhos de RA não são modificados.

Esta etapa não cria página pública, upload, backend, F11.4 ou renders comerciais. PR permanece Draft; sem merge ou produção.
