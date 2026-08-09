# Configurador 3D KARV

Aplicação canônica do Configurador 3D KARV, construída como base nova sobre os
contratos aprovados na F0. O código do MVP em `KARV-LP/3D` é apenas referência
funcional e não deve ser copiado para esta base.

## Desenvolvimento

Requisitos: Node.js 22+ e npm 10+.

```bash
npm ci
npm run dev
```

Validação completa:

```bash
npm run ci
```

Documentação da fundação: [`docs/F1-FOUNDATION.md`](docs/F1-FOUNDATION.md).

## F0 — contratos canônicos

- Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Materiais: [`docs/MATERIAL-CONTRACT.md`](docs/MATERIAL-CONTRACT.md)
- RA e QR: [`docs/AR-CONTRACT.md`](docs/AR-CONTRACT.md)
- Mapa de superfícies: [`contracts/surface-map.json`](contracts/surface-map.json)
- Schemas públicos: [`schemas/`](schemas/)
- Evidências: [`docs/F0-VALIDATION.md`](docs/F0-VALIDATION.md)

## Contratos F0

O validador de contratos permanece integrado a `npm test` e verifica schemas,
hash/tamanho do GLB, cobertura mesh/material e completude da configuração.
