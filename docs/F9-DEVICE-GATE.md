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
| D1  | Chrome desktop    | 3D + configuração + QR              | PENDENTE |
| D2  | Edge desktop      | 3D + configuração + QR              | PENDENTE |
| D3  | Safari desktop    | 3D + configuração + QR              | PENDENTE |
| A1  | Chrome Android    | receber QR + restaurar configuração | PENDENTE |
| A2  | Android WebXR     | entrar em RA                        | PENDENTE |
| I1  | Safari iPhone     | receber QR + restaurar configuração | PENDENTE |
| I2  | iPhone Quick Look | entrar em RA                        | PENDENTE |
| Q1  | desktop → Android | payload F7 intacto                  | PENDENTE |
| Q2  | desktop → iPhone  | payload F7 intacto                  | PENDENTE |

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

- [ ] QR abre a URL HTTPS correta;
- [ ] configuração é restaurada antes da entrada em RA;
- [ ] Chrome detecta suporte WebXR corretamente;
- [ ] RA abre sem recarregar uma poltrona neutra;
- [ ] materiais permanecem iguais ao configurador;
- [ ] poltrona posiciona no piso;
- [ ] escala física é plausível/correta;
- [ ] rotação/movimentação da sessão RA não deforma a geometria;
- [ ] retorno ao navegador preserva a configuração.

### iPhone

- [ ] QR abre a URL HTTPS correta no Safari;
- [ ] configuração é restaurada antes da entrada em RA;
- [ ] Quick Look abre a experiência compatível;
- [ ] materiais permanecem visualmente consistentes dentro das limitações do Quick Look;
- [ ] poltrona posiciona no piso;
- [ ] escala física é plausível/correta;
- [ ] retorno ao Safari preserva a configuração.

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

| ID  | Dispositivo / SO / navegador | Resultado | Evidência | Observação |
| --- | ---------------------------- | --------- | --------- | ---------- |
| D1  |                              | PENDENTE  |           |            |
| D2  |                              | PENDENTE  |           |            |
| D3  |                              | PENDENTE  |           |            |
| A1  |                              | PENDENTE  |           |            |
| A2  |                              | PENDENTE  |           |            |
| I1  |                              | PENDENTE  |           |            |
| I2  |                              | PENDENTE  |           |            |
| Q1  |                              | PENDENTE  |           |            |
| Q2  |                              | PENDENTE  |           |            |

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
