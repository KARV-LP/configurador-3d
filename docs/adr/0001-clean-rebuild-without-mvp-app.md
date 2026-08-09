# ADR 0001 — Reconstrução limpa sem reutilizar o `app/` do MVP

- Status: aceito para o contrato F0
- Data: 2026-08-09
- Decisores: KARV

## Contexto

`KARV-LP/3D` validou seleção de superfícies, troca de revestimentos e direção de
produto. Também acumulou acoplamento entre DOM, UI, nomes técnicos do GLB,
catálogo local e dependências runtime externas. Copiar `app/` levaria essas
restrições para a aplicação canônica.

## Decisão

Construir `KARV-LP/configurador-3d` como base nova. O repositório MVP é fonte de
requisitos, referência de regressão e origem de assets expressamente aprovados,
mas seu `app/` não será copiado, importado nem usado como dependência.

Contratos de geometria, superfície, material, configuração e RA precedem a
fundação técnica. Implementações devem depender de IDs públicos e schemas, não
de detalhes históricos do MVP.

## Consequências

Positivas:

- fronteiras de domínio testáveis;
- nenhuma dívida estrutural herdada por cópia;
- Biblioteca KARV permanece fonte oficial;
- configuração e RA podem evoluir sem depender da UI.

Custos:

- funções já demonstradas serão reimplementadas;
- paridade precisa de critérios e testes explícitos;
- o MVP continua disponível durante a transição para comparação.

## Alternativas rejeitadas

- Copiar `app/` e refatorar incrementalmente: mantém acoplamentos e torna a
  fronteira entre legado e arquitetura nova ambígua.
- Continuar o desenvolvimento no MVP: não cria uma fonte canônica limpa e
  prolonga dependências já identificadas.

