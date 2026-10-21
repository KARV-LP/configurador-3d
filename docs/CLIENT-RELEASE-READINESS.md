# Liberação do configurador para clientes

## Estado do candidato

O configurador possui mapeamento de arte validado nas seis faces da poltrona, build estático e
integração live com a Biblioteca KARV. Este documento separa o que já pode ser publicado como
experiência de demonstração do fluxo comercial que ainda não existe.

## Gate antes do preview HTTPS

1. publicar esta branch e abrir PR contra `main`;
2. exigir CI verde no SHA candidato, incluindo `npm run ci` e `npm run e2e:live`;
3. gerar Deploy Preview a partir do mesmo SHA usando `netlify.toml`;
4. validar no preview desktop, upload de arte, persistência, QR e restauração mobile;
5. registrar URL, SHA, horário e resultado do smoke.

Os PDFs precisam corresponder à proporção do molde canônico. Arquivos com página maior, margens
brancas ou proporção divergente continuam sendo rejeitados para impedir distorção silenciosa.

## Device Gate obrigatório

A alteração do GLB adicionou canais UV de arte. Embora não altere vértices, triângulos, escala ou
forma, ela afeta o material exibido no runtime 3D e pode alcançar RA. Antes da produção, repetir no
preview HTTPS pelo menos:

- Chrome e Edge desktop: seis artes, resumo, persistência e QR;
- Android Chrome + WebXR: restauração por QR, materiais, piso e escala;
- iPhone Safari + Quick Look: restauração por QR, materiais, piso e escala;
- retorno da RA ao navegador sem perda de configuração.

Emulador e Chromium headless não substituem Android e iPhone físicos.

## Domínio e rollback

Destino planejado: `https://personalize.k-arv.com`.

Não alterar DNS antes de o preview passar no smoke e de existir um deployment anterior ou página
de manutenção definida para rollback. No cutover:

1. registrar o deployment e SHA atualmente ativos;
2. aplicar no DNS somente os valores fornecidos pelo site Netlify aprovado;
3. aguardar TLS válido para o domínio final;
4. publicar exclusivamente o SHA aprovado de `main`;
5. repetir o smoke no domínio final;
6. em qualquer falha crítica, restaurar o deployment anterior, sem reescrever `main`.

## Fluxo comercial ainda ausente

A aba **Sua ARTE** prepara a imagem localmente e mantém o arquivo somente no navegador. A versão
atual não possui:

- envio da arte ou configuração para a KARV;
- armazenamento, recuperação ou histórico do cliente;
- consentimento, política de retenção ou exclusão de arquivos;
- identificação do cliente;
- solicitação de orçamento, aprovação comercial, pagamento ou pedido;
- painel interno para atendimento acompanhar uma configuração.

Assim, o primeiro release pode ser usado como demonstração e compartilhamento da configuração de
materiais. Para receber artes e gerar pedidos, esses itens exigem uma fase própria com backend,
autenticação/autorização, política de privacidade e regras comerciais aprovadas.

## Critério de liberação

Clientes só devem receber o domínio final após PR/CI, preview HTTPS, Device Gate físico e smoke de
produção aprovados. Tag de release e promoção para produção continuam ações explícitas posteriores;
não fazem parte da preparação automática deste candidato.
