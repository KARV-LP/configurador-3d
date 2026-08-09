# F8 — QA, CI, segurança e performance

## Objetivo

Transformar as validações acumuladas de F0–F7 em um gate único de release antes do Device Gate F9.

## CI bloqueante

O workflow oficial executa, nesta ordem:

1. Prettier;
2. ESLint com zero warnings;
3. guard de identificadores técnicos, metadata privada e CDNs proibidas;
4. `npm audit --audit-level=moderate`;
5. contratos F0 + unitários/integration;
6. TypeScript + Vite production build;
7. budgets de geometria e bundle;
8. Playwright hermético desktop/mobile;
9. Playwright live contra a Biblioteca KARV publicada em `main`.

Qualquer falha impede o PR de satisfazer o gate F8.

## Dependências e toolchain

- versões de aplicação e desenvolvimento permanecem fixadas no `package.json` e `package-lock.json`;
- AJV foi elevado para 8.20.0 para remover a vulnerabilidade moderada GHSA-2g4f-4pwh-qvx6;
- o audit bloqueia vulnerabilidades `moderate`, `high` e `critical`;
- Actions usam runtimes Node 24 atuais: `checkout@v6`, `setup-node@v6` e `upload-artifact@v7`;
- imports usados pelo Vite config têm extensões explícitas para compatibilidade com o loader nativo futuro.

## Contrato 3D

O validador F0 continua sendo a fonte da verdade e recalcula o GLB real. Ele bloqueia divergência de:

- SHA-256;
- tamanho do asset;
- glTF 2.0 e extensão Draco obrigatória;
- geometry id/version;
- 11 bindings técnicos;
- 10 superfícies configuráveis e 1 fixa;
- vertex/triangle counts;
- câmera e limites;
- vazamento de nomes técnicos ou metadata privada.

Além da igualdade com o manifesto, F8 introduz budgets máximos:

| Métrica              |     Limite |
| -------------------- | ---------: |
| GLB canônico         |  800.000 B |
| vértices canônicos   |    150.000 |
| triângulos canônicos |    260.000 |

Modelo aprovado na entrada de F8: 647.280 B, 144.781 vértices e 245.118 triângulos.

## Bundle

| Métrica                   |       Limite |
| ------------------------- | -----------: |
| maior chunk JavaScript    |  1.400.000 B |
| JavaScript total          |  2.200.000 B |
| CSS total                 |     80.000 B |
| `dist/` total             |  4.500.000 B |

Os budgets são medidos sobre o build real de produção e bloqueiam o CI.

## Jornada crítica E2E

O smoke de release prova em comportamento, e não por busca de strings:

- aplicação e modelo chegam ao estado `ready`;
- até 20 requests são permitidos antes do viewer ficar interativo;
- tempo até viewer `ready` deve ser <= 20 s no runner CI;
- superfície é selecionada diretamente no 3D;
- material pode ser trocado na UI;
- material PBR é aplicado em uma área;
- o mesmo material é aplicado em toda a poltrona;
- reset geral retorna ao baseline;
- QR é gerado a partir do estado corrente;
- nenhum `console.error` ou `pageerror` ocorre na jornada.

Os testes existentes continuam cobrindo filtros, persistência F7, reload, QR desktop→mobile, fallback AR, touch e restauração de câmera.

## Biblioteca KARV

O CI hermético usa fixture controlada para regressão determinística. Depois dele, um gate live separado executa `pbr-live.spec.ts` contra:

`KARV-LP/karv-material-library/main/public/v1/catalog.json`

Esse gate exige catálogo real, Base Color, Normal e AO acessíveis e material aplicado corretamente no Scene Graph. Assim, quebra do contrato publicado da Biblioteca bloqueia o configurador antes de F9.

A responsabilidade de publicação, dimensões e integridade criptográfica dos assets continua no CI da própria `karv-material-library`.

## Texturas e memória

O runtime usa cache com leases/refcount e LRU já coberto por unitários:

- requests concorrentes/repetidos são deduplicados;
- recursos ativos não são evictados;
- leases são liberados em reset/dispose;
- o cache mantém no máximo seis conjuntos idle por padrão.

Medição física de memória GPU varia por navegador/dispositivo e não é tratada como número confiável no Chromium headless. F9 deve observar memória/estabilidade em Android e iPhone reais sem alterar estes limites lógicos.

## Pendências permitidas após F8

Nenhuma regressão funcional, estrutural, de segurança ou contrato conhecida pode permanecer aberta.

A única classe de validação deliberadamente posterior é hardware físico AR/GPU, pertencente à F9.
