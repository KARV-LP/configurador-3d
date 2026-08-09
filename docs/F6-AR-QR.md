# F6 — RA integrada + handoff por QR Code

## Objetivo

Conectar a configuração persistente da F7 à experiência de realidade aumentada sem criar um segundo formato de estado e sem permitir que um modo AR apresente uma poltrona diferente da configurada.

## Arquitetura

### ARCompatibility

Classifica o dispositivo e combina a plataforma com `canActivateAR` publicado pelo `<model-viewer>`:

- Android → WebXR;
- iPhone/iPad → Quick Look;
- desktop → handoff por QR;
- demais dispositivos → fallback explícito no 3D.

### ARController

Responsável apenas pela integração com o runtime do viewer:

- detectar capacidade;
- ativar RA a partir do gesto do usuário;
- observar `ar-status`;
- capturar câmera;
- mover para vista lateral do handoff;
- restaurar exatamente câmera anterior.

### QRHandoff

Consome `ConfigurationSession` da F7. Não serializa estado próprio.

Saída:

```text
?config=<token-f7>&intent=ar
```

O QR é gerado localmente com a dependência `qrcode`; nenhum serviço externo recebe o link ou payload.

## Desktop

1. usuário aciona `Ver no ambiente`;
2. câmera e painéis atuais são capturados;
3. viewer vai para vista lateral mantendo materiais;
4. UI sobrepõe QR Code à composição lateral;
5. QR contém o mesmo token F7 da configuração corrente;
6. fechar o modo QR restaura câmera e painéis capturados;
7. assignments e materiais não são alterados pelo modo QR.

O QR permanece UI em screen-space. Ele não é gravado em Base Color, Normal, AO nem em qualquer material da poltrona.

## Mobile

Um link com `intent=ar` passa primeiro pelo fluxo normal de hidratação F7. Somente depois da restauração a interface oferece RA.

- Android compatível: `webxr`;
- iOS/iPadOS compatível: `quick-look`;
- incompatível: mantém o 3D configurado e oferece compartilhamento/retorno.

## Fidelidade de materiais

`ar-modes` é limitado a:

```text
webxr quick-look
```

Scene Viewer não participa desta versão porque recarrega o asset original e não garante as alterações PBR aplicadas em runtime. Esse modo só pode ser reavaliado quando existir asset GLB configurado por sessão.

Quick Look usa o USDZ gerado pelo `<model-viewer>` quando não há `ios-src`, permitindo que o estado do modelo editado seja levado ao fluxo iOS. A confirmação em hardware real continua sendo F9.

## Escala

- `ar-scale="fixed"`;
- `ar-placement="floor"`;
- unidade física canônica: metro;
- nenhuma escala livre do produto na experiência AR.

## Segurança

- validação F7 ocorre antes do handoff/restauração;
- token não contém metadata privada;
- QR local, sem API de terceiros;
- `Permissions-Policy: xr-spatial-tracking=(self)`;
- falha ou incompatibilidade nunca substitui silenciosamente a configuração por um asset neutro.

## Limite do gate F6

A F6 comprova automaticamente:

- contrato de compatibilidade;
- geração de QR;
- preservação de token F7;
- restauração em nova sessão mobile;
- configuração preservada quando AR não está disponível;
- atributos do runtime AR;
- snapshot/restauração da câmera desktop.

A F6 **não declara validação física final** de Android/iPhone. O teste em dispositivos reais é o gate específico da F9.
