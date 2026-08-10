# F10 · ajuste pré-cutover de navegação 3D

## Objetivo

Estabilizar a interação da câmera antes do cutover de produção e adicionar uma navegação explícita pelas faces configuráveis da poltrona.

## Escopo

- bloquear pan da câmera para impedir deslocamento acidental do pivô;
- reduzir sensibilidade do orbit;
- reposicionar o pivô vertical para o centro de gravidade visual da poltrona, mantendo o eixo X no centro geométrico;
- restringir inclinação vertical para evitar vistas excessivamente aéreas/soltas;
- adicionar barra horizontal superior com as 10 faces configuráveis;
- manter sincronização entre seleção por clique/toque no 3D e seleção pela barra;
- preservar materiais, configuração, QR e RA.

## Fora de escopo

- geometria GLB;
- UV/PBR;
- serialização F7;
- fluxo QR/RA;
- domínio de produção.

## Gate

Este ajuste precisa de CI verde e aprovação visual KARV antes de qualquer merge ou cutover.
