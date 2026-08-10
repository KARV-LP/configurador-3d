# Operação e manutenção — Configurador 3D KARV

## Fonte canônica

Aplicação: `KARV-LP/configurador-3d`.

Biblioteca pública de materiais: `KARV-LP/karv-material-library`.

MVP histórico: `KARV-LP/3D` — somente referência/regressão, sem desenvolvimento funcional paralelo.

## Pré-requisitos de release

- Node.js `>=22.12.0`;
- npm `>=10`;
- `npm ci`;
- `npm run ci` verde;
- teste live da Biblioteca KARV verde no CI;
- Device Gate físico vigente para alterações que afetem 3D/RA/QR/material runtime.

## Deploy

O build de produção é gerado por:

```bash
npm ci
npm run ci
npm run build
```

Saída: `dist/`.

`netlify.toml` é o contrato de deploy estático atual: build `npm run build`, publish `dist`, SPA fallback para `/index.html`, headers de segurança e cache imutável para geometria/vendor.

### Cutover de produção

1. selecionar o SHA aprovado de `main`;
2. validar CI do mesmo SHA;
3. gerar/confirmar preview HTTPS;
4. registrar o deployment atualmente ativo como ponto de rollback;
5. conectar o destino de produção à repo canônica;
6. publicar o SHA aprovado;
7. executar o smoke de `docs/F10-RELEASE.md`;
8. somente após PASS criar `v1.0.0` (ou próxima versão) apontando para o SHA publicado.

Não promover branch de feature diretamente para produção.

## Rollback

Rollback é por **deployment/SHA conhecido**, não por edição emergencial em `main`.

### Critérios para rollback imediato

- GLB não carrega;
- Biblioteca pública indisponível sem fallback seguro;
- aplicação de material corrompe configuração;
- QR perde/trunca estado;
- RA abre geometria/material incompatível;
- erro crítico impede configuração/pedido;
- regressão de segurança identificada após publicação.

### Procedimento

1. interromper novas promoções;
2. identificar o último SHA de produção com smoke PASS;
3. republicar o artefato/deployment desse SHA no provedor;
4. validar o endpoint final em desktop e mobile;
5. registrar incidente com SHA defeituoso, SHA restaurado e sintoma;
6. corrigir em branch/PR normal;
7. repetir F8 e, quando aplicável, o trecho afetado da F9 antes de nova promoção.

Nunca reescrever histórico de `main` para rollback de produção.

## Atualização da geometria

A geometria oficial é tratada como contrato versionado.

Para substituir `base.glb`/derivados:

1. atualizar a fonte geométrica aprovada;
2. recalcular hash, tamanho, vértices, triângulos e bindings no manifesto;
3. revisar `contracts/surface-map.json` se nomes/bindings mudarem;
4. executar `npm run validate:contracts`;
5. executar `npm run ci` completo;
6. repetir Device Gate F9 se a mudança puder afetar escala, câmera, seleção ou RA.

Não substituir apenas o GLB ignorando manifesto e surface map.

## Atualização de materiais

Materiais são publicados primeiro em `KARV-LP/karv-material-library`.

Fluxo:

1. publicar metadata pública sem campos privados/fornecedor;
2. para PBR production, disponibilizar Base Color + Normal + AO e parâmetros físicos válidos;
3. manter `material_id` público estável;
4. validar integridade dos assets/hash quando previsto pelo contrato;
5. executar o gate live da Biblioteca no configurador;
6. somente então considerar o material disponível para produção.

O configurador não deve duplicar catálogo privado nem inventar PBR ausente.

## Persistência e compatibilidade

O estado compartilhável usa o contrato F7 versionado e público. QR/RA consomem esse mesmo payload.

Mudança incompatível no formato exige nova versão de schema e estratégia explícita de migração/fallback. Não reutilizar silenciosamente a versão anterior com semântica diferente.

## Monitoramento básico de produção

Na fase inicial, os sinais operacionais obrigatórios são:

- status do deployment no provedor;
- CI do SHA publicado;
- smoke pós-publicação;
- erros críticos observados no console/browser durante smoke e suporte;
- disponibilidade da Biblioteca pública/PBR;
- incidentes registrados em GitHub Issue com SHA e plataforma.

Se a frequência de uso justificar telemetria contínua, introduzir um provedor de observabilidade em PR separado, com política de privacidade e payload revisados antes de produção. A F10 não autoriza envio de dados do usuário a terceiro por padrão.

## Política de manutenção

Toda nova funcionalidade do Configurador 3D entra em `KARV-LP/configurador-3d` por branch → PR → CI → gate KARV.

`KARV-LP/3D` pode receber apenas documentação de preservação, correções necessárias para manter o histórico acessível ou referências de regressão explicitamente autorizadas.
