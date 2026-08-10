# F10 — Release canônico do Configurador 3D KARV

## Decisão

`KARV-LP/configurador-3d` é a fonte canônica para todo desenvolvimento funcional do Configurador 3D KARV.

`KARV-LP/3D` permanece preservado como MVP histórico, referência de regressão e registro dos experimentos que validaram o produto. Ele não recebe novas funcionalidades em paralelo ao configurador canônico.

## Versão inicial de produção

Versão preparada: **1.0.0**.

A tag/release `v1.0.0` só deve ser criada a partir do `main` após:

1. merge aprovado da F10;
2. CI pós-merge verde;
3. publicação no destino de produção aprovado;
4. smoke test pós-publicação verde.

## Evidência dos gates anteriores

- F0 — contratos canônicos: concluída;
- F1 — fundação técnica: concluída;
- F2 — Core 3D: concluída;
- F3 — Biblioteca KARV: concluída;
- F4 — PBR runtime: concluída;
- F5 — UI/UX oficial: concluída;
- F6 — RA + QR: concluída;
- F7 — persistência/serialização: concluída;
- F8 — QA/CI/segurança/performance: concluída;
- F9 — Device Gate físico: concluída em desktop, Android e iPhone.

A F9 está registrada em `docs/F9-DEVICE-GATE.md`.

## Destino de produção

Destino comercial alvo: `https://personalize.k-arv.com`.

A troca do destino público é um **cutover controlado**, não parte implícita do merge documental. Antes do cutover devem estar disponíveis:

- build de produção do `main` aprovado;
- configuração de deploy apontando para esta repo;
- domínio/TLS válido;
- smoke test pré-cutover no preview HTTPS;
- referência do último deploy funcional anterior para rollback.

## Smoke pós-publicação

Executar em HTTPS no destino final:

1. carregar o configurador e o GLB oficial;
2. selecionar uma superfície;
3. aplicar material PBR publicado;
4. validar Resumo;
5. recarregar e confirmar persistência;
6. abrir `Ver no ambiente`;
7. validar geração de QR;
8. abrir o QR em celular e confirmar restauração;
9. confirmar ausência de erro crítico visível;
10. registrar SHA, horário e resultado PASS/FAIL.

Qualquer FAIL mantém a F10 aberta e aciona rollback conforme `docs/OPERATIONS.md`.

## Checklist final F10

- [x] F0 aprovada;
- [x] F1 aprovada;
- [x] F2 aprovada;
- [x] F3 aprovada;
- [x] F4 aprovada;
- [x] F5 aprovada;
- [x] F6 aprovada;
- [x] F7 aprovada;
- [x] F8 aprovada;
- [x] F9 aprovada em dispositivos reais;
- [x] repo canônica definida;
- [x] versão inicial `1.0.0` definida;
- [x] operação, manutenção e rollback documentados;
- [x] integração com Biblioteca KARV documentada;
- [x] atualização de geometria e materiais documentada;
- [ ] PR F10 aprovado e mergeado;
- [ ] CI pós-merge verde;
- [ ] destino de produção conectado à repo canônica;
- [ ] smoke pós-publicação verde;
- [ ] tag/release `v1.0.0` criada no SHA publicado;
- [ ] MVP `KARV-LP/3D` marcado no `main` como referência histórica.

## Regra de fechamento

A Issue F10 somente fecha depois que **produção + smoke + versão rastreável + transição documental do MVP** estiverem concluídos. O merge do PR de preparação, isoladamente, não é suficiente para declarar a F10 encerrada.
