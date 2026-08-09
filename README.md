# Configurador 3D KARV

Nova aplicação canônica do Configurador 3D KARV.

Este repositório começa pelos contratos da fase F0. O código do MVP em
`KARV-LP/3D` é apenas referência funcional e não deve ser copiado para esta
base.

## F0 — contratos canônicos

- Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Materiais: [`docs/MATERIAL-CONTRACT.md`](docs/MATERIAL-CONTRACT.md)
- RA e QR: [`docs/AR-CONTRACT.md`](docs/AR-CONTRACT.md)
- Mapa de superfícies: [`contracts/surface-map.json`](contracts/surface-map.json)
- Schemas públicos: [`schemas/`](schemas/)
- Evidências: [`docs/F0-VALIDATION.md`](docs/F0-VALIDATION.md)

## Validação

```bash
npm ci
npm test
```

O validador verifica os schemas, o hash e o tamanho do GLB, a cobertura
mesh/material de todas as primitivas e a completude de uma configuração.

