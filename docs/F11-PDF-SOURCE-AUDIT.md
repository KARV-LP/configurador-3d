# F11.3 — Inspeção das fontes PDF recebidas

Branch `feat/f11-custom-proposals` · Issue #30 · PR #31 em Draft.

Base conferida: `80a12c0c94aee57304ae8c87634afd2636a8dc2e`. Nenhuma alteração no GLB, UVs, bindings, Biblioteca, F7 ou RA.

## Resultado da inspeção

Os seis PDFs abrem sem erro, possuem uma página sem rotação e contêm, cada um, um único contorno vetorial com preenchimento de cor sólida e linha de contorno técnica. Não contêm imagens rasterizadas, textos, estampas direcionais, indicação de topo/frente ou marcas de registro. As páginas foram renderizadas e inspecionadas individualmente.

| Fonte recebida                                         | `surface_id` proposto | Cor visual do preenchimento | Página, mm    | Contorno, mm      |
| ------------------------------------------------------ | --------------------- | --------------------------- | ------------- | ----------------- |
| `Assento(20261020-121451).pdf` (Assento.pdf do pedido) | `seat`                | Ocre                        | 883,2 × 889,6 | 600 × 800         |
| `ENCOSTO_FRONTAL.pdf`                                  | `backrest-front`      | Verde                       | 883,2 × 889,6 | 600 × 400         |
| `ENCOSTO_LATERAL.pdf`                                  | `backrest-side`       | Magenta                     | 883,2 × 716,8 | 209,240 × 212,112 |
| `ENCOSTO_TRASEIRO.pdf`                                 | `backrest-rear`       | Rosa claro                  | 883,2 × 889,6 | 600 × 800         |
| `LATERAL_EXTERNA.pdf`                                  | `side-outer`          | Amarelo                     | 883,2 × 716,8 | 744,100 × 476,088 |
| `LATERAL_INTERNA.pdf`                                  | `side-inner`          | Vermelho                    | 883,2 × 716,8 | 499,299 × 180,458 |

Dimensões de contorno correspondem ao bounding box vetorial, sem acrescentar espessura de linha ou margem de costura. Não representam automaticamente dimensão final da peça montada ou cobertura UV. Cores visuais foram conferidas no PDF renderizado; não são uma especificação colorimétrica de produção.

O mapeamento acima é consistente com os nomes dos arquivos, layers internos e bindings canônicos. O layer de `ENCOSTO_LATERAL.pdf` é `Encosto Face Externa`, enquanto o nome da malha canônica é `ENCOSTO_LATERAL`: identificação visual ainda deve ser conferida. Não se trata de `side-outer`.

As faces `side-rear`, `side-top`, `piping-seat` e `piping-backrest` não têm PDF correspondente neste lote. Não estender lateral interna/externa para essas faces por suposição; numa aplicação parcial, devem seguir a política de baseline determinístico já implementada na F11.2.

Proveniência completa (hash SHA-256, bytes, dimensões, nome recebido e associação): `docs/f11/pdf-source-audit.json`. Os PDFs originais não foram modificados nem enviados ao runtime.

## Limites encontrados antes da conversão/aplicação

A imagem `KARV-REFERENCIA` citada no pedido não consta nos seis anexos recebidos. O texto da instrução também termina em “Esta fase deve comprovar que”, sem a continuação.

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
