# Contrato público de materiais KARV

Status: contrato v1 proposto para aprovação no gate F0.

## Origem e responsabilidade

`KARV-LP/karv-material-library` é a fonte oficial. O configurador consome um
registro público validado por `schemas/material.schema.json`; não duplica a
biblioteca e não deduz propriedades por nome de arquivo.

Um material só aparece no configurador quando:

- `publication.status` é `published`;
- `publication.configurator_enabled` é `true`;
- `pbr.status` é `production`;
- `compatibility.geometry_ids` inclui `karv-chair`;
- todos os assets e hashes obrigatórios são válidos.

## Identidade e taxonomia

`material_id` é estável, público e independente do nome exibido. Renomear um
tecido não altera configurações salvas.

A navegação usa metadata pública:

- tecidos técnicos: `Cor → Material → Tecido`;
- criações autorais: `KARV Design`;
- filtros: tipo, família de cor, coleção e propriedades funcionais.

Nenhum filtro pode fazer parsing de filename ou consultar fornecedor.

## PBR mínimo

| Campo | Produção | Regra |
| --- | --- | --- |
| Preview | obrigatório | WebP/PNG/JPEG leve para catálogo |
| Base Color | obrigatório | sem luz/sombra assada; espaço de cor sRGB no runtime |
| Normal | obrigatório | convenção OpenGL, intensidade explícita |
| AO | obrigatório | mapa e intensidade explícita |
| Roughness | obrigatório | fator 0–1; mapa opcional |
| Metalness | obrigatório | exatamente 0 para tecido |
| Escala física | obrigatória | largura/altura do repeat em milímetros |
| Direção | obrigatória | urdume em U, V ou não direcional |

Assets são endereçados por URI pública e SHA-256. O hash é a chave preferencial
de cache; paths podem mudar sem alterar a identidade do conteúdo.

## Escala física no runtime

A UI não calibra escala. O controlador de materiais combina:

- `repeat_width_mm` e `repeat_height_mm` do material;
- `meters_per_uv_unit`, rotação e flips da superfície.

Para a baseline isotrópica v1:

```text
repetições_u = meters_per_uv_unit × 1000 / repeat_width_mm
repetições_v = meters_per_uv_unit × 1000 / repeat_height_mm
```

Rotação e flips do `texture_frame` são aplicados depois. O mesmo material deve
manter dimensão física coerente em todas as superfícies, mesmo quando as UVs têm
densidades distintas.

O método `area-ratio` é uma calibração geométrica inicial. Materiais com direção
visual forte devem ser bloqueados para release até o frame da superfície estar
`visual-approved`.

## Carregamento e falhas

1. Validar o registro antes de mostrar o card.
2. Carregar preview leve para navegação.
3. Baixar mapas PBR sob demanda.
4. Verificar hash antes de promover o asset ao cache persistente.
5. Reutilizar texturas idênticas por hash.
6. Liberar recursos GPU sem referências.

Material inválido, incompatível ou incompleto é omitido do catálogo e gera erro
observável. Ele não derruba o Core 3D e nunca substitui silenciosamente outro
material. Falha de mapa opcional em material não publicado pode usar preview;
material habilitado para produção precisa cumprir o conjunto mínimo.

## Limite público/privado

Permitido no contrato público: nome, tipo, cor, coleção, recursos funcionais,
publicação, compatibilidade, preview, PBR e escala física.

Proibido: fornecedor, contato, custo, margem, SKU privado, nota de negociação,
origem interna de captura e credenciais. Esses dados permanecem fora do catálogo
consumido pelo navegador.

## Compatibilidade e evolução

- Campo novo opcional pode entrar em revisão compatível.
- Mudança de significado ou campo obrigatório exige nova `schema_version`.
- Material retirado usa `retired`; seu ID não é reutilizado.
- Configurações antigas preservam o ID. A restauração retorna erro controlado se
  o asset deixou de estar disponível.

Um exemplo completo está em
[`../contracts/examples/material.example.json`](../contracts/examples/material.example.json).

