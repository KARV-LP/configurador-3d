# Configurador 3D KARV

**Fonte canônica do Configurador 3D KARV.**

Todo desenvolvimento funcional novo do configurador deve ocorrer neste repositório. O antigo `KARV-LP/3D` é preservado somente como MVP histórico, referência de regressão e registro técnico dos experimentos que validaram o produto.

Versão de produção preparada: **1.0.0**.

## Desenvolvimento

Requisitos: Node.js 22.12+ e npm 10+.

```bash
npm ci
npm run dev
```

Validação completa:

```bash
npm run ci
```

## Operação e release

- Release canônico F10: [`docs/F10-RELEASE.md`](docs/F10-RELEASE.md)
- Deploy, manutenção e rollback: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Decisão arquitetural canônica: [`docs/adr/0002-canonical-configurator-and-mvp-retirement.md`](docs/adr/0002-canonical-configurator-and-mvp-retirement.md)
- QA/release gate: [`docs/F8-QA-GATE.md`](docs/F8-QA-GATE.md)
- Device Gate físico: [`docs/F9-DEVICE-GATE.md`](docs/F9-DEVICE-GATE.md)

## Arquitetura por fase

- Fundação: [`docs/F1-FOUNDATION.md`](docs/F1-FOUNDATION.md)
- Core 3D: [`docs/F2-CORE.md`](docs/F2-CORE.md)
- Biblioteca KARV: [`docs/F3-MATERIAL-LIBRARY.md`](docs/F3-MATERIAL-LIBRARY.md)
- PBR runtime: [`docs/F4-PBR-RUNTIME.md`](docs/F4-PBR-RUNTIME.md)
- UI/UX: [`docs/F5-UI-UX.md`](docs/F5-UI-UX.md)
- RA + QR: [`docs/F6-AR-QR.md`](docs/F6-AR-QR.md)
- Persistência: [`docs/F7-PERSISTENCE.md`](docs/F7-PERSISTENCE.md)

## Contratos F0

- Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Materiais: [`docs/MATERIAL-CONTRACT.md`](docs/MATERIAL-CONTRACT.md)
- RA e QR: [`docs/AR-CONTRACT.md`](docs/AR-CONTRACT.md)
- Mapa de superfícies: [`contracts/surface-map.json`](contracts/surface-map.json)
- Schemas públicos: [`schemas/`](schemas/)
- Evidências: [`docs/F0-VALIDATION.md`](docs/F0-VALIDATION.md)

O validador de contratos permanece integrado a `npm test` e verifica schemas, hash/tamanho do GLB, cobertura mesh/material e completude da configuração.
