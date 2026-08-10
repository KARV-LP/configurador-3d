# F9 — Device Gate físico de RA

## Objetivo

Validar em hardware real que o configurador aprovado em F8 preserva geometria, materiais, escala e estado no fluxo desktop → QR → mobile → RA → retorno ao configurador.

A F9 não altera o contrato F6/F7. O candidato físico testado foi o `main` pós-F8:

`6894edc6a861e85292509a5449ebfa402d969f5d`

## Regra de aprovação

A F9 só pode receber `DONE` com validação física em Android e iPhone. Emulador, Chromium headless e CI não substituem esse gate.

## Endpoint HTTPS usado no Device Gate

`https://karv-lp.github.io/configurador-3d/`

O deployment foi usado apenas para o gate físico. O workflow temporário de Pages não integra o candidato final da F9.

## Matriz obrigatória — resultado final

- **D1 · Chrome desktop:** PASS
- **D2 · Edge desktop:** PASS
- **D3 · Safari desktop:** PASS
- **A1 · Chrome Android:** PASS
- **A2 · Android WebXR:** PASS
- **I1 · Safari iPhone:** PASS
- **I2 · iPhone Quick Look:** PASS
- **Q1 · desktop → Android:** PASS
- **Q2 · desktop → iPhone:** PASS

## Checklist validado

### Desktop

- [x] modelo carrega sem erro visível;
- [x] seleção de superfície funciona;
- [x] materiais aplicados permanecem visualmente corretos;
- [x] resumo corresponde às superfícies alteradas;
- [x] `Ver no ambiente` abre o fluxo QR;
- [x] QR é legível pelo celular;
- [x] fechar o modo QR devolve a câmera anterior;
- [x] configuração permanece intacta após fechar o QR.

### Android físico

- [x] QR abre a URL HTTPS correta;
- [x] configuração é restaurada antes da entrada em RA;
- [x] Chrome detecta suporte WebXR corretamente;
- [x] RA abre sem recarregar uma poltrona neutra;
- [x] materiais permanecem iguais ao configurador;
- [x] poltrona posiciona no piso;
- [x] escala física é plausível/correta;
- [x] rotação/movimentação não deforma a geometria;
- [x] retorno ao navegador preserva a configuração.

### iPhone físico

- [x] QR abre a URL HTTPS correta no Safari;
- [x] configuração é restaurada antes da entrada em RA;
- [x] Quick Look abre a experiência RA compatível;
- [x] materiais permanecem visualmente consistentes;
- [x] poltrona posiciona no piso;
- [x] escala física é plausível/correta;
- [x] retorno ao Safari preserva a configuração.

## Registro das evidências

Todos os resultados abaixo foram confirmados diretamente pela KARV em 2026-08-10 durante o Device Gate físico.

- **D1 · Windows / Chrome:** configuração, resumo, QR e persistência aprovados.
- **D2 · Windows / Microsoft Edge:** 3D, configuração, resumo, QR, retorno de câmera e persistência aprovados.
- **D3 · macOS / Safari:** fluxo desktop aprovado integralmente.
- **A1 · Android / Chrome:** QR recebido e configuração restaurada corretamente.
- **A2 · Android / WebXR:** RA, materiais, piso, escala e geometria aprovados.
- **I1 · iOS / Safari:** QR recebido e configuração restaurada corretamente.
- **I2 · iOS / Quick Look:** RA, materiais, piso e escala aprovados.
- **Q1 · Desktop Chrome → Android Chrome:** payload/configuração F7 preservados.
- **Q2 · Desktop Chrome → iPhone Safari:** payload/configuração F7 preservados.

Modelos e versões exatas dos sistemas/navegadores e capturas de tela/vídeo não foram anexados ao repositório. A evidência permanente deste gate é a confirmação direta KARV registrada neste documento e na Issue #10. Não houve FAIL funcional.

## Prova de escala física

A escala foi conferida visualmente nos dois fluxos de RA físicos. Não foi identificado erro grosseiro de escala; a poltrona manteve proporção plausível de produto real e posicionamento coerente no piso.

## Tratamento de FAIL

Qualquer FAIL funcional exigiria issue corretiva vinculada à Issue #10 e repetição do gate afetado após passar novamente a F8. Nenhum FAIL foi reportado nesta execução.

## Gate final

**PASS — F9 Device Gate aprovado.**

Critérios concluídos:

- Chrome, Edge e Safari desktop aprovados;
- Android físico aprovado em Chrome + WebXR;
- iPhone físico aprovado em Safari + Quick Look;
- QR desktop → Android e desktop → iPhone aprovados;
- materiais preservados;
- escala física aprovada;
- posicionamento no piso aprovado;
- retorno ao configurador sem perda de estado;
- nenhuma divergência funcional aberta.
