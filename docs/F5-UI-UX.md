# F5 — UI/UX oficial do Configurador KARV

## Objetivo

Substituir a interface diagnóstica de F2–F4 por uma experiência orientada ao cliente, mantendo o Core 3D, a Biblioteca e o runtime de materiais sem mudanças de responsabilidade.

## Direção visual

- poltrona como protagonista do viewport;
- fundo infinito cinza-claro com luz direcional, horizonte sutil e sombra de contato;
- tipografia editorial para títulos e UI discreta para controles;
- bronze KARV (`#B08D57`) apenas como acento;
- poucos controles permanentes sobre o 3D;
- nenhum nome de mesh, material GLB, versão de geometria ou linguagem de fase técnica na UI pública.

## Desktop

- header compacto sobre o stage;
- viewer ocupa o viewport integral;
- seleção direta da superfície abre uma bandeja contextual inferior;
- dock inferior concentra Revestir e Resumo;
- a bandeja permite trocar a área sem manter uma barra de faces sobre o 3D;
- materiais seguem Cor → Material → Tecido e separam Tecidos / KARV Design;
- resumo apresenta somente nomes públicos e materiais escolhidos.

## Mobile

- viewer continua prioritário;
- seleção por touch abre bottom sheet de materiais;
- sheet limitado a 72dvh e com controles de toque de pelo menos 38–44 px;
- backdrop fecha o contexto sem perder configuração;
- ações de aplicação permanecem no rodapé do sheet.

## Estados

- loading: estado dedicado dentro da Biblioteca;
- empty: mensagem própria para filtros sem resultado e para KARV Design ainda sem publicações;
- error: indisponibilidade da Biblioteca preserva o 3D e oferece `Tentar novamente`;
- aplicação: idle/loading/applied/error com feedback não técnico.

## RA

`Ver no ambiente` aparece no topo porque faz parte da experiência final, mas a F5 não inicia RA nem QR. Nesta etapa a ação apenas informa que a experiência será ativada na próxima fase correspondente.

## Gate

Desktop e mobile devem permitir:

1. selecionar uma superfície diretamente na poltrona;
2. navegar por Cor → Material → Tecido;
3. aplicar material na área ou em toda a poltrona;
4. restaurar a área ou a poltrona;
5. recuperar o resumo da configuração;
6. concluir o fluxo sem exposição de identificadores técnicos.
