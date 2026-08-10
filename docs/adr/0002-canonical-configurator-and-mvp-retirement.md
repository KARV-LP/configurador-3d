# ADR 0002 — Configurador canônico e aposentadoria do MVP

- Status: Accepted
- Data: 2026-08-10

## Contexto

O projeto KARV validou o produto inicialmente em `KARV-LP/3D`. A reconstrução em `KARV-LP/configurador-3d` foi criada a partir dos contratos F0 e evoluiu pelas fases F1–F9, incluindo Biblioteca pública, PBR físico, UI/UX oficial, persistência, QR/RA, QA automatizado e Device Gate em hardware real.

Manter duas aplicações como fontes ativas criaria divergência de contrato, duplicação de correções e risco de publicar comportamento incompatível.

## Decisão

`KARV-LP/configurador-3d` passa a ser a **única fonte canônica** de desenvolvimento funcional do Configurador 3D KARV.

`KARV-LP/3D` é preservado como:

- histórico técnico;
- referência de regressão;
- registro do MVP e dos experimentos que validaram o produto.

O repositório histórico não deve receber novas funcionalidades do configurador em paralelo.

## Consequências

- novas features, correções funcionais, contratos, UI, materiais runtime e RA entram somente em `configurador-3d`;
- a Biblioteca KARV continua independente e é consumida por contrato público;
- referências técnicas úteis do MVP podem ser consultadas, mas não copiadas como fonte arquitetural;
- o histórico não é apagado;
- rollback de produção usa versões/SHA do configurador canônico, não retorno ao MVP como linha ativa de produto;
- qualquer exceção exige decisão arquitetural explícita.

## Release inicial

A primeira versão de produção da base canônica é preparada como `1.0.0`. A tag `v1.0.0` deve apontar para o SHA efetivamente publicado e aprovado por smoke pós-publicação.
