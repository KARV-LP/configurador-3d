# Revestimentos: categorias e galeria

Issue: https://github.com/KARV-LP/configurador-3d/issues/42

O painel segue a referência anexada à issue: Poltrona KARV à esquerda no desktop,
categorias na lateral do painel, galeria e detalhes ao lado, faixa de comparação
abaixo e ações de aplicação no rodapé. No celular, o painel continua em página
opaca com retorno ao 3D, categorias horizontais e conteúdo rolável.

## Catálogo compatível

Nenhum Revestimento ou asset novo é publicado por esta mudança. A fonte oficial
continua sendo `KARV-LP/karv-material-library`. Os novos campos são opcionais:

```json
{
  "category": "Estampado",
  "composition": "Texto fornecido pela KARV",
  "description": "Texto fornecido pela KARV",
  "media": {
    "images": [
      {
        "src": "./assets/<material-id>/photo-01.webp",
        "thumbnail": "./assets/<material-id>/photo-01-thumb.webp",
        "alt": "Descrição fornecida pela KARV"
      }
    ],
    "video": {
      "src": "./assets/<material-id>/video.mp4",
      "poster": "./assets/<material-id>/video-poster.webp"
    }
  }
}
```

As oito categorias oficiais são Impermeabilizado, Linho, Veludo, Chenille,
Estampado, Bouclé, Suede e Jacquard. Sem `category`, o filtro consulta somente os
valores publicados de `material_type` e `technologies`, ignorando caixa e acentos.
A opção Todas preserva acesso aos tipos existentes que não correspondem às oito
categorias. Não são inferidas categorias a partir da imagem ou nome do produto.

Sem fotos novas, usa-se o preview oficial existente. Composição e descrição só
aparecem quando fornecidas. URLs de mídia devem pertencer ao namespace do próprio
Revestimento, como os assets atuais. Fotos e miniaturas usam lazy loading;
o vídeo é montado apenas ao selecioná-lo, com controles, poster (ou preview
existente), `preload="none"`, sem autoplay. Trocar a mídia, o Revestimento ou a aba
desmonta o vídeo. A galeria informa falha de mídia e permite selecionar outra.

Couro e Courvin é uma aba reservada, sem produtos nem ações de aplicação.
A publicação futura de seus itens requer definir o contrato de catálogo junto
à Biblioteca oficial. Nesta etapa não se altera o canal 3D existente.

Selecionar um card não aplica automaticamente no modelo. As duas ações existentes
continuam usando o fluxo de aplicação já aprovado. Seleções ocultadas pelos filtros
não podem ser aplicadas acidentalmente. GLB, UVs, bindings, mapas, persistência,
Sua ARTE, envio de proposta e RA não são alterados.

## Revisão

A aprovação visual da KARV permanece obrigatória antes do merge.
As mídias finais devem ser fornecidas e publicadas na Biblioteca oficial; os testes
usam dados locais de teste e não adicionam fotos ou vídeos ao catálogo real.
