# Pipeline da Biblioteca KARV — TECIDOS

Esta pipeline recebe somente as Base Colors WebP aprovadas, preserva cada arquivo original byte a
byte e deriva Normal Map OpenGL, AO e thumbnail para publicação no configurador.

## Incluir um tecido

1. Crie `assets/karv-tecidos/inbox/<fabric-id>/`. O ID deve usar minúsculas e hífens, por exemplo
   `karv-linho-001`.
2. Adicione exatamente estas nove Base Colors:

   - `Assento.webp`
   - `ENCOSTO_FRONTAL.webp`
   - `ENCOSTO_LATERAL.webp`
   - `ENCOSTO_TRASEIRO.webp`
   - `LATERAL_EXTERNA.webp`
   - `LATERAL_INTERNA.webp`
   - `LATERAL_REAR.webp`
   - `LATERAL_TOP.webp`
   - `VIVO.webp`

   `VIVO.webp` é a nona face técnica oficial e atende às duas superfícies de vivo que compartilham
   a mesma instância de material no contrato atual (`piping-seat` e `piping-backrest`).

3. Faça commit e push para `main`. O workflow **Processar Biblioteca KARV TECIDOS** valida todas as
   entradas, gera os mapas e publica o resultado em `public/karv-tecidos/<fabric-id>/`.

Também é possível validar localmente:

```bash
npm run fabric:build -- \
  --input assets/karv-tecidos/inbox/karv-linho-001 \
  --output public/karv-tecidos/karv-linho-001 \
  --fabric-id karv-linho-001
```

## Saída

Cada face recebe uma pasta canônica com:

- `base-color.webp`: cópia binária exata da entrada;
- `normal.png`: Normal Map OpenGL, com as mesmas dimensões e alpha;
- `ao.webp`: AO otimizado para web, com as mesmas dimensões e alpha.

O tecido também recebe `thumbnail.webp` em 512 × 512, sempre derivado de `Assento.webp` com
ajuste `contain` (sem recorte), e `metadata.json`. O metadata registra as superfícies, URIs,
dimensões, bytes e SHA-256 de todos os arquivos, totalizando 27 mapas técnicos.

## Garantias e falhas

A geração acontece em uma área temporária e só substitui uma saída depois que todas as faces foram
processadas. A execução falha antes de publicar se houver uma face ausente, nome inesperado, arquivo
que não seja WebP, alteração de hash da Base Color ou divergência de dimensões entre Base Color,
Normal e AO. Nunca redimensione, recorte, rotacione nem recomprima os arquivos de entrada.

A pasta de referência vinculada à Issue #36 contém atualmente oito arquivos. Ela só pode ser
processada quando `VIVO.webp` for aprovado e adicionado.
