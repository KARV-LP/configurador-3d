# F11.3 — Inspeção das fontes PDF recebidas

Branch `feat/f11-custom-proposals` · Issue #30 · PR #31 em Draft.

Base conferida: `80a12c0c94aee57304ae8c87634afd2636a8dc2e`. Nenhuma alteração no GLB, UVs, bindings, Biblioteca, F7 ou RA.

## Resultado da inspeção

Os oito PDFs abrem sem erro e possuem uma página sem rotação. Os seis arquivos iniciais contêm um
único contorno vetorial; os dois arquivos adicionados em 2026-10-23 incluem rasters ocultos de
referência do Illustrator, além do preenchimento vetorial visível. As páginas foram renderizadas e
inspecionadas individualmente.

| Fonte recebida                                         | `surface_id` proposto | Cor visual do preenchimento | Página, mm    | Contorno, mm      |
| ------------------------------------------------------ | --------------------- | --------------------------- | ------------- | ----------------- |
| `Assento(20261020-121451).pdf` (Assento.pdf do pedido) | `seat`                | Ocre                        | 883,2 × 889,6 | 600 × 800         |
| `ENCOSTO_FRONTAL.pdf`                                  | `backrest-front`      | Verde                       | 883,2 × 889,6 | 600 × 400         |
| `ENCOSTO_LATERAL.pdf`                                  | `backrest-side`       | Magenta                     | 883,2 × 716,8 | 209,240 × 212,112 |
| `ENCOSTO_TRASEIRO.pdf`                                 | `backrest-rear`       | Rosa claro                  | 883,2 × 889,6 | 600 × 800         |
| `LATERAL_EXTERNA.pdf`                                  | `side-outer`          | Amarelo                     | 883,2 × 716,8 | 744,100 × 476,088 |
| `LATERAL_INTERNA.pdf`                                  | `side-inner`          | Vermelho                    | 883,2 × 716,8 | 499,299 × 180,458 |
| `LATERAL_REAR.pdf`                                     | `side-rear`           | Roxo                        | 1000 × 1000   | 100 × 440         |
| `LATERAL_TOP.pdf`                                      | `side-top`            | Azul                        | 1000 × 1000   | 100 × 1000        |

Dimensões de contorno correspondem ao bounding box vetorial, sem acrescentar espessura de linha ou margem de costura. Não representam automaticamente dimensão final da peça montada ou cobertura UV. Cores visuais foram conferidas no PDF renderizado; não são uma especificação colorimétrica de produção.

O mapeamento acima é consistente com os nomes dos arquivos, layers internos e bindings canônicos. O layer de `ENCOSTO_LATERAL.pdf` é `Encosto Face Externa`, enquanto o nome da malha canônica é `ENCOSTO_LATERAL`: identificação visual ainda deve ser conferida. Não se trata de `side-outer`.

As faces `piping-seat` e `piping-backrest` continuam sem PDF correspondente. `side-rear` e
`side-top` foram confirmadas no novo GLB pelo canal de arte `TEXCOORD_2` e pelas imagens de teste
fornecidas.

Proveniência completa (hash SHA-256, bytes, dimensões, nome recebido e associação):
`docs/f11/pdf-source-audit.json`. Os originais de `LATERAL_REAR` e `LATERAL_TOP` tinham cerca de
303 MB cada. As versões publicadas removem somente as cinco imagens ocultas de referência e
preservam exatamente o resultado visível em renderização, a página de 1 m × 1 m e o contorno útil.

## Limites encontrados antes da conversão/aplicação

As imagens de teste recebidas comprovam a associação das duas novas faixas às superfícies, mas não
contêm um motivo compartilhado entre peças.

Os PDFs fornecem moldes de cores sólidas. Permitem verificar identificação e associação técnica por face. Sem arte direcional ou elementos compartilhados, não permitem demonstrar escala de motivos, espelhamento, orientação de uma estampa ou continuidade entre faces. Não concluir esses gates a partir de uma cor uniforme.

Uma conversão da página inteira incluiria margens brancas e contornos técnicos, enquanto o pipeline custom pressupõe textura preparada no espaço UV da face. Rasterizar e esticar essa página alteraria escala/composição de forma não validada. Não tratar linha técnica como estampa e não inferir recorte, sangria, rotação ou espelhamento apenas pelo nome do PDF.

Por esses motivos, esta entrega registra a auditoria sem produzir/aplicar texturas ou marcar uma proposta como aprovada. Não foram inventadas artes, extraídas cores da imagem de referência ou criadas referências a assets inexistentes. Nenhum gate visual da F11.3 foi marcado como PASS.

## Continuação necessária

1. Receber `KARV-REFERENCIA` e a continuação da instrução interrompida.
2. Conferir a correspondência física de cada molde com o GLB e definir o registro de página/contorno para UV sem alterar a geometria.
3. Distinguir uma validação diagnóstica usando as cores atuais de uma futura validação de estampa/continuidade; esta última requer PDFs contendo a arte aprovada com elementos verificáveis.
4. Converter apenas o conteúdo preparado e registrar assets reais (hash, bytes, dimensões) em proposta F11 multi-face.
5. Aplicar pelo coordenador F11.2, testar integridade/rollback/reset e produzir evidências técnicas por ângulo.

**Status: auditoria concluída; F11.3 pendente de insumos/conferência visual.** PR permanece Draft, sem merge ou alterações na main.

## Adendo de calibração — confirmação Blender

A KARV confirmou posteriormente que os PDFs oficiais encaixam diretamente na malha/UV
correspondente no Blender, em comportamento equivalente a clamp. Essa evidência supera a pendência
anterior sobre a natureza espacial do molde: cada PDF passa a ser o template canônico de sua face,
não uma imagem livre.

A conversão não pode criar ajustes particulares por proposta. Rotação, origem, flip e janela da
área útil pertencem ao perfil versionado da face e devem ser reutilizados por `surface_id`. Se uma
arte preenchida conforme o PDF divergir no navegador, o defeito deve ser tratado como registro
PDF → UV antes de qualquer alteração da composição.

Perfis vigentes: `docs/f11/canonical-pdf-uv-profiles.json`.
