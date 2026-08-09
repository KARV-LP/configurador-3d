# F8 — Quality Gate: QA, CI, segurança e performance

## Objetivo

Consolidar um gate reproduzível antes da validação física F9 e do release canônico F10. A F8 não muda a experiência visual aprovada; ela endurece contratos, dependências, segurança, budgets e cobertura comportamental.

## Pipeline obrigatório

`npm run ci` executa, nesta ordem:

1. Prettier check;
2. ESLint com zero warnings;
3. guard de exposição pública;
4. `npm audit --audit-level=moderate`;
5. contratos F0 + unit/integration tests;
6. TypeScript + build Vite;
7. budgets estáticos;
8. Playwright E2E.

O CI GitHub usa Actions com runtime Node 24 e instala Node 22 para o projeto. O lockfile permanece obrigatório e todas as dependências diretas usam versões exatas.

## Gate 3D

`validate-contracts.mjs` preserva as verificações de:

- GLB 2.0 válido;
- SHA-256 e byte length iguais ao manifesto;
- geometria id/version;
- extensão Draco obrigatória;
- cobertura 1:1 entre bindings GLB e `surface-map`;
- `surface_id` único;
- 10 superfícies configuráveis e 1 fixa;
- superfície fixa fora dos assignments;
- vértices/triângulos iguais ao manifesto;
- limites de câmera;
- ausência de metadata privada nos contratos públicos.

`check-budgets.mjs` acrescenta limites independentes para:

- GLB <= 800.000 B;
- triângulos <= 260.000;
- upload vertices <= 150.000;
- largura entre 0,70 e 0,85 m;
- altura entre 0,68 e 0,82 m;
- profundidade entre 0,75 e 0,90 m.

O manifesto atual permanece dentro dessas faixas sem redefinir a identidade física da poltrona.

## Biblioteca / materiais

`RuntimeCatalogGuard` é executado tanto no catálogo recebido pela rede quanto no cache local.

Bloqueios:

- IDs públicos duplicados;
- asset fora do mesmo origin/diretório público do catálogo;
- path de asset com casing incompatível ou traversal;
- PBR de produção sem integridade completa;
- Base Color / Normal / AO com dimensões diferentes;
- edge de textura > 2048 px;
- textura > 2.097.152 pixels;
- soma Base Color + Normal + AO > 3.670.016 B (3,5 MiB).

Itens incompatíveis continuam sendo filtrados pelo parser público; ambiguidade estrutural do catálogo inteiro é tratada como falha e usa somente cache previamente validado quando disponível.

## Performance

Budgets de build:

- maior chunk JS <= 1.400.000 B;
- JS total <= 2.200.000 B;
- CSS total <= 80.000 B;
- `dist/` <= 4.500.000 B.

Budgets E2E:

- modelo interativo em <= 15.000 ms no runner de referência;
- <= 16 requests até o estado `ready`;
- **0 previews de material antes da abertura da Biblioteca**.

O último item evita custo de catálogo visual no caminho crítico da poltrona.

## Texturas / memória

A F4 já limita o cache lógico a 6 entradas ociosas e usa leases/refcount. A F8 combina esse descarte com o teto de 3,5 MiB por conjunto PBR publicado. Memória GPU real não é exposta de forma portátil/confiável pelo browser e, portanto, não é inventada como métrica de CI; o gate usa os controles mensuráveis disponíveis: resolução, bytes publicados, cache lógico, reaplicação e rollback.

## Segurança

O guard cobre `index.html`, `src`, `vite.config.ts` e `netlify.toml` e bloqueia:

- identificadores técnicos do GLB na UI pública;
- chaves de metadata privada;
- CDNs de runtime proibidas;
- padrões comuns de credenciais/tokens no código público;
- ausência do Draco local.

Headers de produção incluem CSP, `nosniff`, política de referrer, `SAMEORIGIN` e permissão XR restrita a `self`. A CSP permite somente assets locais e o namespace público oficial da Biblioteca, além de `blob:` onde necessário para o fluxo AR.

## Cobertura comportamental

Além dos fluxos existentes F2–F7, a F8 adiciona prova E2E de:

- budget do caminho crítico;
- ausência de preview eager;
- troca de um PBR por outro na mesma superfície;
- assignment continua único após a troca;
- Scene Graph recebe o roughness do segundo material;
- resumo reflete somente o material final;
- console permanece sem erro crítico.

## Débitos resolvidos

- `ajv` atualizado para versão sem o advisory moderado conhecido;
- `npm audit` passa a bloquear vulnerabilidades moderadas ou superiores;
- imports de configuração recebem extensão explícita e deixam de depender do futuro loader legado do Vite;
- Actions atualizadas para runtimes atuais, removendo o warning Node 20 do pipeline.

## Fora do escopo

- prova visual/escala em aparelho físico: F9;
- decisão final de release e aposentadoria do legado: F10;
- alteração de GLB/UV;
- ampliação do catálogo público.

## Gate F8

A F8 pode ser aprovada somente quando o head final do PR tiver CI verde, `npm audit` limpo no nível configurado, todos os budgets dentro dos limites e nenhum workflow temporário presente no diff.
