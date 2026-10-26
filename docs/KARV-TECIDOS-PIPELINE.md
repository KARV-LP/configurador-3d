# Pipeline da Biblioteca KARV — TECIDOS

Esta pipeline recebe somente as Base Colors WebP aprovadas, preserva cada arquivo original byte a
byte e deriva Normal Map OpenGL, AO e thumbnail para publicação na Biblioteca e consumo pelo
configurador.

## Regra de publicação

`KARV-LP/karv-material-library` é a única fonte oficial de materiais. Toda inclusão ou atualização
de tecido deve ser feita nesse repositório. O Configurador contém a ferramenta de processamento e o
runtime consumidor, mas não recebe nem publica cópias dos tecidos.

## Incluir ou atualizar um tecido

1. No checkout de `karv-material-library`, prepare uma pasta temporária fora dos diretórios
   públicos. Use o ID canônico do catálogo, por exemplo `fabric-kv-005`. Em atualizações, preserve o
   ID existente.
2. Adicione exatamente estas oito Base Colors aprovadas à pasta temporária:

   - `Assento.webp`
   - `ENCOSTO_FRONTAL.webp`
   - `ENCOSTO_LATERAL.webp`
   - `ENCOSTO_TRASEIRO.webp`
   - `LATERAL_EXTERNA.webp`
   - `LATERAL_INTERNA.webp`
   - `LATERAL_REAR.webp`
   - `LATERAL_TOP.webp`

   A nona face técnica, `piping`, é derivada automaticamente por cópia binária de
   `LATERAL_TOP.webp`. Ela atende às duas superfícies de vivo que compartilham a mesma instância de
   material no contrato atual (`piping-seat` e `piping-backrest`). A tira superior e o vivo,
   portanto, mantêm exatamente a mesma cor, resolução e enquadramento.

3. Execute a ferramenta deste repositório apontando a saída para
   `karv-material-library/public/v1/assets/<fabric-id>/face-set/`.
4. No repositório da Biblioteca, copie os aliases públicos necessários para
   `public/v1/assets/<fabric-id>/`, atualize `public/v1/catalog.json` e execute
   `node scripts/validate-public-catalog.mjs`.
5. Faça commit e abra o PR no `karv-material-library`. Não faça commit das fontes temporárias nem de
   arquivos gerados no Configurador.

Também é possível validar localmente:

```bash
npm run fabric:build -- \
  --input ../entrada-fabric-kv-005 \
  --output ../karv-material-library/public/v1/assets/fabric-kv-005/face-set \
  --fabric-id fabric-kv-005
```

## Saída

Cada face recebe uma pasta canônica com:

- `base-color.webp`: cópia binária exata da entrada;
- `normal.png`: Normal Map OpenGL, com as mesmas dimensões e alpha;
- `ao.webp`: AO otimizado para web, com as mesmas dimensões e alpha.

O conjunto também recebe `thumbnail.webp` em 512 × 512, sempre derivado de `Assento.webp` com
ajuste `contain` (sem recorte), e `metadata.json`. O metadata registra as superfícies, URIs,
dimensões, bytes e SHA-256 de todos os arquivos, totalizando 27 mapas técnicos.

## Garantias e falhas

A geração acontece em uma área temporária e só substitui uma saída depois que todas as faces foram
processadas. A execução falha antes de publicar se houver uma face ausente, nome inesperado, arquivo
que não seja WebP, alteração de hash da Base Color ou divergência de dimensões entre Base Color,
Normal e AO. Nunca redimensione, recorte, rotacione nem recomprima os arquivos de entrada.

O vivo não precisa ser enviado separadamente. A validação final e a publicação acontecem sempre no
PR da Biblioteca.
