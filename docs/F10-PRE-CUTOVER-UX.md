# F10 · ajuste pré-cutover de navegação 3D

## Objetivo

Estabilizar a interação da câmera antes do cutover de produção e manter a poltrona como protagonista com controles contextuais discretos.

## Escopo

- bloquear pan da câmera para impedir deslocamento acidental do pivô;
- reduzir sensibilidade do orbit;
- reposicionar o pivô vertical para o centro de gravidade visual da poltrona, mantendo o eixo X no centro geométrico;
- restringir inclinação vertical para evitar vistas excessivamente aéreas/soltas;
- limitar a aproximação máxima a cerca de 70% da área útil do ambiente;
- selecionar faces diretamente no 3D ou pelo seletor contextual da bandeja de revestimentos;
- remover a barra superior de faces e o painel lateral permanente;
- apresentar tecidos em bandeja inferior somente quando solicitados;
- distinguir materiais disponíveis em 3D dos acabamentos ainda em preparação;
- permitir nova tentativa quando a Biblioteca estiver temporariamente indisponível;
- usar fundo infinito cinza-claro, luz lateral e sombra de contato para dar profundidade ao estúdio;
- preservar materiais, configuração, QR e RA.

## Fora de escopo

- geometria GLB;
- UV/PBR;
- serialização F7;
- fluxo QR/RA;
- domínio de produção.

## Gate

Este ajuste precisa de CI verde e aprovação visual KARV antes de qualquer merge ou cutover.
