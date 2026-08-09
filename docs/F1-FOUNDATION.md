# Fundação técnica — F1

## Stack versionada

- Vite 8 + React 19 + TypeScript 6 em modo estrito.
- `<model-viewer>` 4.3.1 empacotado no bundle local.
- Three.js 0.183.2 fixado como peer explícito.
- Decoder Draco copiado do pacote Three.js para `/vendor/draco/` durante o build.
- Vitest para unitários e Playwright/Chromium para smoke E2E.
- ESLint 10 e Prettier 3.

Nenhum script ou decoder crítico é carregado por CDN. O smoke E2E falha se
qualquer request HTTP sair da origem da aplicação.

## Módulos

| Diretório          | Responsabilidade F1                                      |
| ------------------ | -------------------------------------------------------- |
| `src/domain`       | contrato e validação do manifesto canônico               |
| `src/3d`           | paths, registro do viewer, decoder e carregamento do GLB |
| `src/materials`    | porta futura para o catálogo oficial                     |
| `src/configurator` | porta futura para o estado de configuração               |
| `src/ar`           | porta futura de detecção de RA                           |
| `src/ui`           | apresentação do estado de carregamento                   |
| `schemas`          | contratos públicos aprovados na F0                       |
| `tests/e2e`        | smoke real do modelo e da política sem CDN               |

Materiais PBR, seleção de superfícies, configuração e RA permanecem fora da F1.

## Pipeline

```bash
npm ci
npm run format:check
npm run lint
npm run guard
npm test
npm run build
npm run budget
npm run e2e
```

`npm run ci` executa a sequência completa. O workflow GitHub Actions instala
Chromium, executa o gate e publica `dist/` como artifact `deploy-preview` por
sete dias. `netlify.toml` habilita Deploy Preview quando o repositório for
conectado ao site Netlify aprovado.

## Budgets iniciais

Os limites estão em `budgets.json` e são verificados após o build:

- GLB canônico: 800 kB;
- maior chunk JavaScript: 1,4 MB;
- JavaScript total (inclui o decoder Draco local): 2,2 MB;
- CSS total: 80 kB;
- `dist/` total: 4,5 MB.

Qualquer aumento exige alteração explícita do budget no mesmo PR e justificativa
na descrição.

## Guard

O guard bloqueia na camada pública:

- nomes técnicos do GLB;
- campos de fornecedor/custo/metadata privada;
- URLs conhecidas de CDN runtime;
- remoção da configuração local do decoder Draco.
