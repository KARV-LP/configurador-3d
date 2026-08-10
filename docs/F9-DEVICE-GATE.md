# F9 — Device Gate físico de RA

## Objetivo

Validar em hardware real que o configurador aprovado em F8 preserva geometria, materiais, escala e estado no fluxo desktop → QR → mobile → RA → retorno ao configurador.

A F9 não altera o contrato F6/F7. O candidato físico é o mesmo build aprovado em `main` após F8.

## Regra de aprovação

A F9 só pode receber `DONE` quando houver evidência em dispositivos físicos Android e iPhone. Emulador, Chromium headless e CI não substituem esse gate.

## Endpoint de teste

O teste deve ocorrer em um deployment HTTPS do commit F8 aprovado.

Commit de referência inicial:

`6894edc6a861e85292509a5449ebfa402d969f5d`

Não usar servidor LAN HTTP para o gate de RA: WebXR exige contexto seguro no dispositivo.

## Configuração-padrão do teste

Antes de gerar o QR:

1. abrir o configurador;
2. aplicar `Croma Musgo Pet Friendly` em uma superfície configurável;
3. aplicar um segundo material publicado em outra superfície, quando disponível;
4. deixar pelo menos duas superfícies visualmente distintas;
5. confirmar no desktop que o resumo mostra a configuração esperada;
6. abrir `Ver no ambiente` e gerar o QR.

Se apenas um material PBR estiver publicado no catálogo no momento do gate, usar esse material em duas superfícies e manter uma terceira no baseline para verificar a preservação por zona.

## Matriz obrigatória

| ID  | Ambiente          | Fluxo                               | Estado   |
| --- | ----------------- | ----------------------------------- | -------- |
| D1  | Chrome desktop    | 3D + configuração + QR              | PASS     |
| D2  | Edge desktop      | 3D + configuração + QR              | PENDENTE |
| D3  | Safari desktop    | 3D + configuração + QR              | PENDENTE |
| A1  | Chrome Android    | receber QR + restaurar configuração | PASS     |
| A2  | Android WebXR     | entrar em RA                        | PASS     |
| I1  | Safari iPhone     | receber QR + restaurar configuração | PASS     |
| I2  | iPhone Quick Look | entrar em RA                        | PASS     |
| Q1  | desktop → Android | payload F7 intacto                  | PASS     |
| Q2  | desktop → iPhone  | payload F7 intacto                  | PASS     |

## Checklist por dispositivo

### Desktop

- [ ] modelo carrega sem erro visível;
- [ ] seleção de superfície funciona;
- [ ] materiais aplicados ficam visualmente corretos;
- [ ] resumo corresponde às superfícies alteradas;
- [ ] `Ver no ambiente` abre o fluxo QR;
- [ ] QR é legível pelo celular;
- [ ] fechar o modo QR devolve a câmera anterior;
- [ ] configuração permanece intacta após fechar o QR.

### Android

- [x] QR abre a URL HTTPS correta;
- [x] configuração é restaurada antes da entrada em RA;
- [x] Chrome detecta suporte WebXR corretamente;
- [x] RA abre sem recarregar uma poltrona neutra;
- [x] materiais permanecem iguais ao configurador;
- [x] poltrona posiciona no piso;
- [x] escala física é plausível/correta;
- [x] rotação/movimentação da sessão RA não deforma a geometria;
- [x] retorno ao navegador preserva a configuração.

### iPhone

- [x] QR abre a URL HTTPS correta no Safari;
- [x] configuração é restaurada antes da entrada em RA;
- [x] Quick Look abre a experiência compatível;
- [x] materiais permanecem visualmente consistentes dentro das limitações do Quick Look;
- [x] poltrona posiciona no piso;
- [x] escala física é plausível/correta;
- [x] retorno ao Safari preserva a configuração.

## Prova de escala física

Usar uma referência física simples no ambiente, preferencialmente uma trena no piso.

Aprovação não exige medição fotogramétrica. O objetivo é detectar erros grosseiros de escala, por exemplo poltrona claramente reduzida/ampliada em relação ao tamanho real esperado.

Registrar PASS quando a dimensão visual da poltrona estiver coerente com uma poltrona real e não houver divergência perceptível causada pelo fluxo AR.

## Evidência mínima

Para cada ambiente registrar:

- dispositivo/modelo;
- sistema operacional e versão;
- navegador e versão aproximada;
- data/hora;
- PASS ou FAIL;
- screenshot do configurador restaurado no mobile;
- screenshot ou vídeo curto da poltrona em RA;
- observação sobre escala/material;
- descrição objetiva de qualquer divergência.

## Registro

| ID  | Dispositivo / SO / navegador           | Resultado | Evidência                                      | Observação |
| --- | -------------------------------------- | --------- | ---------------------------------------------- | ---------- |
| D1  | Desktop físico / Chrome               | PASS      | Confirmação direta KARV em 2026-08-10         | Configuração + QR aprovados; captura pendente |
| D2  |                                        | PENDENTE  |                                                |            |
| D3  |                                        | PENDENTE  |                                                |            |
| A1  | Android físico / Chrome               | PASS      | Confirmação direta KARV em 2026-08-10         | Estado restaurado; modelo/SO/captura pendentes |
| A2  | Android físico / WebXR                | PASS      | Confirmação direta KARV em 2026-08-10         | RA, materiais, piso, escala e geometria aprovados; captura pendente |
| I1  | iPhone físico / Safari                | PASS      | Confirmação direta KARV em 2026-08-10         | Estado restaurado; modelo/SO/captura pendentes |
| I2  | iPhone físico / Quick Look            | PASS      | Confirmação direta KARV em 2026-08-10         | RA, materiais, piso e escala aprovados; captura pendente |
| Q1  | Desktop Chrome → Android Chrome       | PASS      | Confirmação direta KARV em 2026-08-10         | Payload/configuração preservados; captura pendente |
| Q2  | Desktop Chrome → iPhone Safari        | PASS      | Confirmação direta KARV em 2026-08-10         | Payload/configuração preservados; captura pendente |

### Execução parcial — 2026-08-10

KARV aprovou integralmente os dois fluxos físicos centrais da F9:

- desktop Chrome → QR → Safari iPhone → Quick Look → retorno ao Safari;
- desktop Chrome → QR → Chrome Android → WebXR → retorno ao navegador.

Isso registra `PASS` operacional em D1, A1, A2, I1, I2, Q1 e Q2.

As capturas e os detalhes exatos de modelo/SO/navegador permanecem pendentes para completar a evidência mínima documental. D2 (Edge desktop) e D3 (Safari desktop) também permanecem pendentes; por isso a F9 continua aberta.

## Tratamento de FAIL

Qualquer FAIL funcional gera issue de correção vinculada à Issue #10 e mantém F9 aberta.

Não corrigir problema físico alterando contrato, geometria ou material sem diagnóstico separado. A correção deve reproduzir o problema, delimitar plataforma afetada e passar novamente F8 antes de repetir o Device Gate afetado.

## Gate final

F9 é aprovada quando:

- Chrome/Edge/Safari desktop estão aprovados;
- Android físico restaura QR e entra em WebXR com configuração consistente;
- iPhone físico restaura QR e entra no fluxo Quick Look com configuração consistente;
- escala física foi conferida;
- retorno ao configurador não perde estado;
- todas as evidências foram registradas;
- não existe FAIL aberto sem issue corretiva.
