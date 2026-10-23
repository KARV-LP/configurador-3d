# Changelog

## Próxima versão

- adiciona os moldes oficiais de Lateral Traseira e Tira Superior da Lateral;
- registra `TEXCOORD_2` como UV de arte para `side-rear` e `side-top`;
- atualiza o pacote de moldes, contratos, testes e documentação de proveniência.

## 1.0.0 — release canônico preparado

Primeira versão de produção da arquitetura canônica do Configurador 3D KARV.

### Inclui

- contratos F0 versionados;
- base React/Vite/TypeScript com model-viewer self-hosted;
- Core 3D com seleção de superfícies e controle de câmera;
- integração pública com `KARV-LP/karv-material-library`;
- PBR runtime com escala física, cache e rollback atômico;
- UI/UX oficial desktop/mobile;
- serialização e persistência F7 com links compartilháveis;
- RA Android via WebXR;
- iOS/iPadOS via Quick Look;
- QR desktop → mobile preservando a configuração;
- QA, auditoria, budgets e Biblioteca live bloqueantes em CI;
- Device Gate físico aprovado em Chrome/Edge/Safari, Android e iPhone;
- documentação operacional, rollback e política de manutenção.

### Governança

`KARV-LP/configurador-3d` é a fonte canônica. `KARV-LP/3D` passa a referência histórica/MVP.

A tag `v1.0.0` somente será criada no SHA efetivamente publicado e aprovado no smoke pós-produção.
