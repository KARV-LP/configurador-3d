# Configurador 3D KARV

Aplicação canônica do Configurador 3D KARV.

O código do MVP em `KARV-LP/3D` permanece apenas como referência funcional e não
deve ser copiado para esta base.

## F0 — contratos canônicos

- Arquitetura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Materiais: [`docs/MATERIAL-CONTRACT.md`](docs/MATERIAL-CONTRACT.md)
- RA e QR: [`docs/AR-CONTRACT.md`](docs/AR-CONTRACT.md)
- Mapa de superfícies: [`contracts/surface-map.json`](contracts/surface-map.json)
- Schemas públicos: [`schemas/`](schemas/)
- Evidências: [`docs/F0-VALIDATION.md`](docs/F0-VALIDATION.md)

## F1 — fundação técnica

A aplicação utiliza React + TypeScript + Vite. O `<model-viewer>` é instalado por
NPM em versão fixa e empacotado pelo Vite; não há dependência runtime de CDN para
o viewer.

Fronteiras iniciais:

```text
src/domain/        contratos e estado sem DOM/React
src/3d/            registro do viewer e contrato de câmera
src/materials/     portas da futura Biblioteca KARV
src/configurator/  portas do estado do configurador
src/ar/            portas do futuro handoff de RA
src/ui/            apresentação mínima
src/app/           shell React
```

### Desenvolvimento

```bash
npm ci
npm run dev
```

### Validação

```bash
npm run guard
npm run lint
npm run format:check
npm test
npm run build
npm run e2e
```

O CI executa o mesmo conjunto e o build aplica budgets explícitos definidos em
[`budgets.json`](budgets.json). O Deploy Preview pode usar `netlify.toml` quando a
REPO estiver conectada ao site aprovado.
