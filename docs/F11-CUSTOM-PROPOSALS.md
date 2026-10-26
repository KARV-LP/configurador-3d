# F11 — Propostas personalizadas da Poltrona KARV

Issue #30 · PR #31 (Draft) · branch `feat/f11-custom-proposals`.

## Auditoria e estratégia F11.2

| Área auditada                      | Constatação e decisão                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PbrMaterialController`            | O catálogo exige PBR completo e calcula repetição pela dimensão física do tecido. F11 usa uma entrada separada `CustomBaseColorSource` e `replaceCustomBaseColors`; não cria `PublicMaterial`/`ProductionPbrMaterial`.                                                                            |
| `Core3DController`                 | Novo `replaceCustomConfiguration` passa pelo controller PBR e trata highlight, sem escrever no `ConfigurationStore`.                                                                                                                                                                              |
| `ConfigurationStore` e F7          | Estado oficial permanece intocado, inclusive após sucesso custom. Não serializar referências custom via F7. A sessão F11 é exclusiva e deve ser encerrada antes de retornar ao fluxo de catálogo.                                                                                                 |
| Base Color / Normal / AO / fatores | Cada proposta parte do baseline capturado na inicialização do viewer: só Base Color é substituído. Normal, AO, roughness, metallic e baseColorFactor preservados. Faces omitidas voltam integralmente ao baseline, inclusive quando havia catálogo ou proposta anterior.                          |
| UV                                 | Usa transform Base Color do baseline quando existe. Sem esse canal, reutiliza `textureTransformForSurface` no controller com escala unitária, mantendo flips/rotação do frame canônico. `physical_size_mm` é referência operacional, não repetição de tecido. Nenhuma lógica UV duplicada em F11. |
| Rollback existente                 | `replaceConfiguration` do catálogo prepara recursos antes de aplicar, restaura estado visual em falha e só depois confirma leases. F11 segue essa estratégia e captura todas as faces antes da primeira escrita.                                                                                  |
| Cache / leases / refcount / LRU    | `TextureCache` existente ganha callback opcional de descarte. O catálogo mantém seu comportamento. F11 usa cache separado com zero ociosos, chave por face/caminho/version/hash e leases. Reaplicação adquire antes de liberar o estado anterior, evitando duplicação.                            |
| Reset / dispose                    | Reset F11 é transação vazia: restaura baseline e libera leases custom. Dispose cancela preparação pendente do controller por geração e libera texturas após desassociar. O coordenador serializa reset/dispose e impede novo apply concorrente.                                                   |
| RA                                 | Nenhum arquivo/atributo/caminho de ativação alterado. Não executar Device Gate físico nesta rodada.                                                                                                                                                                                               |

## Contratos públicos

- `schemas/proposal.schema.json` / `src/proposals/proposal.ts`: `proposal_id` opaco, `contract_version: 1`, referência canônica por ID/versão/SHA-256, status, Revestimentos e título público.
- `schemas/custom-revestimento.schema.json` / `src/proposals/custom-revestimento.ts`: proposta/face, asset/version/status, Base Color, dimensões físicas e de pixels, orientação `canonical-uv`, política `archive-on-replacement`.
- `proposal-resolver.ts`: valida geometria e superfícies configuráveis; rejeita duplicatas, vínculos cruzados e qualquer campo extra em todos os objetos. Apenas proposta e artes `approved` podem ser resolvidas.

Referências custom continuam `custom:<proposal_id>:<surface_id>:v<asset_version>`, exclusivas do coordenador F11. Não são inseridas na Biblioteca KARV nem passadas para serializer/restaurador F7. O título deve ser curado: validação estrutural não detecta dados pessoais em texto livre. Status no JSON não autentica aprovação; procedência/publicação KARV continuam necessárias antes de qualquer futuro uso comercial.

## Loader de assets e integridade

`custom-asset-loader.ts` possui leitura/decodificação injetáveis para testes e implementação browser real:

1. Verifica IDs, versão, aprovação e URI exata `/proposal-assets/<proposal_id>/v<asset_version>/<surface_id>.webp`.
2. Faz fetch same-origin, sem credenciais, redirects proibidos, `no-store` e timeout de 15 segundos. Confere URL final e HTTP 200.
3. Confere MIME `image/webp`, Content-Length quando fornecido e limita o stream independentemente do header.
4. Confere `byte_length` real e SHA-256 calculado com Web Crypto sobre todos os bytes.
5. Confere assinatura RIFF/WEBP/tamanho do container e decodifica com `createImageBitmap`.
6. Compara largura/altura reais e fecha o bitmap de verificação no `finally`.

Limites: 16 MiB por asset, 32 MiB por proposta, 16 milhões de pixels por imagem. Falhas abortam antes de qualquer aplicação visual. O loader não mantém cache de bytes rejeitados. URI externa, query, token, credenciais e redirecionamento não são aceitos.

O adaptador cria a textura exclusivamente de um Blob dos bytes já verificados, por object URL. O viewer não baixa novamente a URI original; isso evita trocar os bytes entre validação e uso.

## Transação, concorrência e estado

`CustomProposalCoordinator.apply(unknown)` revalida o contrato, baixa e decodifica todos os assets e prepara fontes para o Core. O controller adquire todos os recursos antes de capturar/aplicar as faces. Não há await durante a escrita visual/rollback. Só depois do sucesso troca leases e publica `{proposal_id, contract_version, references}` com status `ready`.

Em erro, restaura texturas **e aparência** de todas as faces e libera recursos temporários. A proposta anterior permanece em `state.applied`; status muda para `error`. O `ConfigurationStore` não recebe escrita em nenhum ponto F11. Loading/error/ready pertencem ao coordenador, separado da F7.

Operações de catálogo são bloqueadas enquanto há transação/atribuições custom; transações custom são bloqueadas durante carregamento PBR de catálogo. Aplicações F11 concorrentes são rejeitadas, reset espera a aplicação pendente e dispose impede novas aplicações. O integrador futuro deve usar o coordenador como dono do ciclo custom, aguardar `dispose/reset` antes de encerrar o Core ou voltar ao catálogo e não oferecer edição mista F7/F11.

Falha excepcional do próprio rollback (por exemplo driver rejeitando também a restauração) é fatal e exige recriar o viewer. O erro agregado preserva a causa; leases potencialmente ainda associados ficam em quarentena para evitar destruir texturas em uso. Esse caso não é tratado como sucesso e bloqueia novas aplicações.

## Memória

Cache custom usa leases do `TextureCache` com zero entradas ociosas. A → B libera A após confirmação; A → A compartilha o recurso ativo; rejeição não entra no cache ativo; reset deixa zero entradas custom. O bitmap de verificação é fechado após validar dimensões.

`model-viewer-custom-texture.ts` isola uma limitação do model-viewer 4.3.1: não há dispose público de textura. Usa o símbolo exportado `$correlatedObjects` desse runtime fixado para liberar **apenas** as texturas criadas pela F11 (`Three.Texture.dispose()` e fechamento de imagem quando aplicável), além de revogar object URLs. O adaptador usa o mesmo símbolo para selecionar `Three.Texture.channel` somente quando a arte declara `art_uv_set`; tecidos repetíveis, Normal e AO permanecem no fluxo UV anterior. Nunca libera texturas canônicas ou da Biblioteca. Essa dependência interna deve ser revalidada ao atualizar model-viewer; testes unitários e E2E cobrem a ponte. Não fazer upgrade desse runtime sem regressão.

As UVs de arte comprovadas pelo GLB SID TATTOO são: Assento `TEXCOORD_1`, Frente do encosto `TEXCOORD_1`, Lateral do encosto `TEXCOORD_2`, Traseira do encosto `TEXCOORD_2`, Lateral externa `TEXCOORD_1` e Lateral interna `TEXCOORD_2`. As demais faces mantêm o fallback no canal de tecido até receberem referência comprovada.

## Fixture técnica e verificação no navegador

`assets/proposals/demo-custom/v1/seat.webp` é um quadriculado técnico neutro/ciano de 128 × 128 px, lossless, 62 bytes. SHA-256:

`f6311bd76a18f1b7041cd35a34abb8569da2cb2375571cfed0de12875b5f841b`

`contracts/examples/proposal.example.json` declara esses valores reais. Vite serve/emite somente o arquivo permitido em `/proposal-assets/demo-custom/v1/seat.webp`. A fixture não representa arte comercial ou cliente.

O harness `tests/e2e/f11-harness.html` usa GLB/runtime/Core/controllers reais e a implementação browser do loader. É servido apenas pelo segundo dev server do Playwright (porta 4174); não faz parte de `dist`, não cria rota de produto nem API global no configurador publicado. O E2E confere alteração visual e por slot somente em `seat`, preservação de Normal/AO/fatores/F7, reaplicação sem duplicar, reset baseline, liberação e zero `console.error/pageerror`. Outro cenário mantém hash/bytes de uma imagem corrompida coerentes e exige rejeição pelo decoder real.

`npm test` cobre contratos, integridade, limites, superfície inválida, aplicação parcial, rollback após mutação, A → B, reaplicação, reset/dispose, falha de preparação, concorrência e GLB/F7. O validador de contratos também confere hash/tamanho da fixture em disco.

## Auditoria de dependências

Não foi executado `npm audit fix --force`. Foram aplicadas somente correções compatíveis de patch e lockfile; nenhuma dependência produtiva direta foi alterada.

| Pacote afetado          | Severidade anterior   | Cadeia de dependência                      | Correção                |
| ----------------------- | --------------------- | ------------------------------------------ | ----------------------- |
| `@vitest/mocker` 4.1.10 | Moderada              | dev → Vitest → mocker                      | 4.1.12                  |
| `vitest` 4.1.10         | Moderada (via mocker) | dev direto                                 | 4.1.12, patch explícito |
| `brace-expansion` 5.0.9 | Alta                  | dev → ESLint → minimatch → brace-expansion | 5.0.12, dentro do range |
| `fast-uri` 3.1.5        | Alta                  | dev → AJV → fast-uri                       | 3.1.9, dentro do range  |
| `source-map-js` 1.2.1   | Alta                  | dev → Vite → PostCSS → source-map-js       | 1.2.2, dentro do range  |

O audit após as atualizações retorna **0 vulnerabilidades**. Sem grande migração ou dívida residual dessas cinco ocorrências. A validação completa usa as versões atualizadas.

## Limites e próximo passo

Sem renders comerciais, página de proposta, upload, backend, aprovação comercial, checkout ou mudanças de RA. O código ainda não é exposto como fluxo público na aplicação; é uma fundação exercitada pelo Core e harness técnico.

F11.3 recomendada: consolidar operação/publicação KARV com uma proposta real aprovada, associação aos moldes e validação visual de escala/orientação/continuidade por face. Só depois planejar câmeras/renders padronizados e modo Proposta. Não afirmar fidelidade RA custom sem futura regressão explícita e Device Gate.

## Resultado da validação F11.2 — registro histórico

Os resultados abaixo registram o estado da F11.2 antes da inclusão posterior dos canais UV de
arte no GLB. O estado atual do candidato está descrito em
`docs/CLIENT-RELEASE-READINESS.md`.

- `npm run ci`: **PASS**, incluindo formatação, lint, guard, audit, contratos, 105 testes unitários/contrato, build, budgets e 19 E2E aprovados. O teste live é pulado pelo CI padrão (1 skip).
- E2E F11 isolado: **2/2 PASS**, também aprovado dentro do CI completo, sem `console.error/pageerror`.
- Audit: **0 vulnerabilidades**, contra 5 anteriores.
- GLB local e `main` (`f5f903e30bdadba84250b245723a2abe75c7e49e`): SHA-256 idêntico `878a8b89aa330da1dc7a4be00a5de6c0321ab1273c90c414ed1f22fc851df1bf`.
- Diff revisado: nenhum arquivo de F6/F7/F9, GLB, UV, bindings, surface-map, catálogo/Biblioteca ou componente RA alterado. Biblioteca/PBR/F7 cobertos pelos E2E de regressão.
- Gate live adicional (`npm run e2e:live`): **bloqueado neste ambiente**, pois o fetch direto a `raw.githubusercontent.com/.../catalog.json` falha com `net::ERR_EMPTY_RESPONSE` (sem resposta HTTP). O teste termina em falha ao aguardar o item do catálogo, inclusive no retry. Não foi alterado nem mascarado para ficar verde. Reexecutar em ambiente com acesso ao catálogo publicado antes de afirmar validação live.
- Navegador local: Chromium 153 via executável alternativo em `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, pois o download padrão do Playwright falhou. A dependência alternativa não foi adicionada ao projeto. CI remoto mantém a instalação padrão do Playwright.

**Gate técnico local F11.2: PASS**. Validação live externa pendente por conectividade; PR permanece Draft, sem merge, produção ou Device Gate físico.

## F11.3B — proposta híbrida aprovada

A proposta real `sid-tattoo-p4` integra seis artes aprovadas em WebP e usa o Revestimento oficial `fabric-kv-002` nas quatro superfícies sem arte. O contrato custom continua estritamente `image/webp`; não há suporte JPEG. Mapeamento, hashes, dimensões, fallback, evidências e limites estão documentados em `docs/F11-HYBRID-PROPOSAL.md` e `docs/f11/sid-tattoo-p4-assets.json`.

A implementação permanece restrita ao harness técnico F11 e ao Deploy Preview. Não inicia F11.4, não altera GLB/UV/bindings/surface-map/F7/RA e não publica em produção.

## Regra canônica PDF → UV — comportamento clamp

Os PDFs oficiais são templates espaciais das faces da Poltrona KARV. O conteúdo preenchido no
molde não é tratado como imagem livre: a conversão usa o perfil fixo de `surface_id` e produz a
textura no mesmo registro observado no Blender.

Fluxo obrigatório:

`PDF oficial preenchido → conversão determinística → textura da face → clamp canônico na UV`

- preservar integralmente a área útil do molde;
- manter transformação uniforme e relação 1:1 com o template;
- proibir `cover`, `contain`, stretch, escala X/Y independente e fitting visual;
- proibir reposicionamento ou alteração da arte para compensar projeção;
- investigar divergências primeiro como registro, origem, orientação, rotação, flip ou transform
  de textura;
- reutilizar o mesmo perfil versionado de `surface_id` para todas as propostas futuras,
  inclusive na aba **Sua ARTE**.

Os perfis pertencem à geometria `karv-chair/v2`, não à proposta `sid-tattoo-p4`. O registro
reproduzível está em `docs/f11/canonical-pdf-uv-profiles.json`. A janela
`template_window_px` representa a área útil fixa do template oficial; não é um crop criativo
calculado a partir da arte do cliente. O pipeline somente a aplica quando o raster corresponde às
dimensões canônicas do template. Assets técnicos ou já preparados em outro contrato não recebem
essa transformação implicitamente.

Uma alteração futura de geometria, UV ou molde exige nova versão explícita do perfil; nunca ajuste
silencioso por proposta.

## F11.4 — canais UV de arte validados

O GLB canônico incorpora os canais UV comprovados visualmente para Assento, Frente do encosto,
Lateral do encosto, Traseira do encosto, Lateral externa, Lateral interna, Lateral traseira e
Tira superior da lateral. A forma, a escala, os limites e os 11 bindings permanecem inalterados;
a normalização Draco removeu dados não referenciados, resultando em 144.332 vértices enviados e
245.064 triângulos.

O asset atual possui SHA-256
`923dabfc599034b87721b75abfe2da93149899128a0ba8a2cbc30502f3976a82` e 708.620 bytes. O
budget foi recalibrado explicitamente para 1.200.000 bytes, condicionado à repetição do Device
Gate físico antes da produção. O teste live da Biblioteca KARV valida Base Color, Normal e AO
publicados; PDFs fora da proporção canônica continuam sendo rejeitados.
