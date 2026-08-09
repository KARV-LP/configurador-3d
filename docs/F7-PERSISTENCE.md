# F7 — Estado persistente, serialização e compartilhamento

## Objetivo

Transformar a configuração visual da poltrona em um contrato público reproduzível, independente da sessão React e reutilizável pela futura F6 (QR/RA), por canais comerciais e por integrações KARV.

## Contrato canônico

A F7 reutiliza **sem alterar** `schemas/configuration.schema.json` definido na F0.

Formato emitido:

```json
{
  "$schema": "https://schemas.k-arv.com/configurador-3d/v1/configuration.schema.json",
  "schema_version": 1,
  "geometry": {
    "id": "karv-chair",
    "version": 2,
    "sha256": "<sha256 do GLB canônico>"
  },
  "assignments": {
    "seat": "fabric-kv-002"
  }
}
```

A configuração compartilhável contém somente:

- versão do schema;
- identidade e hash da geometria;
- `surface_id` público;
- ID canônico público do material.

Não são serializados nome visual, coleção, fornecedor, origem, custo, assets, propriedades privadas ou metadata interna da Biblioteca.

## Serialização

`ConfigSerializer`:

1. remove superfícies sem material;
2. ordena `assignments` por `surface_id` para saída determinística;
3. gera JSON compatível com o schema F0;
4. converte o JSON UTF-8 para Base64URL sem padding;
5. valida schema, geometria, SHA-256, superfícies e formato dos IDs na entrada.

Limites defensivos impedem payload/token desproporcional.

## Compatibilidade e migração

- versão atual: `schema_version = 1`;
- não existe migração implícita;
- versão futura desconhecida é rejeitada com fallback seguro;
- geometria deve coincidir em `id`, `version` e `sha256`;
- superfícies fora do `surface-map` canônico são rejeitadas;
- IDs de materiais inexistentes ou sem PBR de produção rejeitam a restauração completa.

Uma futura versão de schema deve introduzir uma migração explícita e testada antes de ser aceita pelo runtime.

## Persistência

Storage local:

`karv.configurator.configuration.v1`

O mesmo token usado em compartilhamento é persistido localmente. Estado vazio remove a chave.

Precedência de hidratação:

1. `?config=<token>` explícito na URL;
2. storage local, somente quando não existe `config` na URL;
3. baseline da poltrona.

Um `config` explícito corrompido/incompatível **não** cai para storage antigo. O configurador abre o baseline e remove o estado persistido incompatível.

## Link compartilhável

A ação `Compartilhar configuração` no resumo gera:

`<url-do-configurador>?config=<token>`

O URL atual é atualizado sem reload e, quando permitido pelo navegador, copiado para o clipboard. Depois que uma sessão está em URL compartilhável, alterações posteriores sincronizam o token para que reload nunca restaure uma combinação antiga.

## Restauração PBR

A restauração resolve cada ID canônico na Biblioteca pública e converte somente materiais com PBR de produção.

`PbrMaterialController.replaceConfiguration()` é atômico:

1. valida todas as superfícies e parâmetros;
2. prepara todas as texturas necessárias;
3. captura o estado visual anterior;
4. aplica todas as superfícies configuradas e restaura baseline nas omitidas;
5. em qualquer falha, restaura integralmente o estado anterior;
6. somente após sucesso libera leases antigos e publica o novo estado no `ConfigurationStore`.

## Relação com F6

F7 não depende de F6. A direção correta é:

`F7 estado/serialização → F6 QR/RA consome o mesmo link/contrato`

O QR da F6 deverá transportar o URL gerado pela F7 sem criar um segundo formato de configuração.

## Gate

A F7 só pode ser aprovada quando:

- serializer valida contra o schema F0;
- round-trip `serialize → decode` é determinístico;
- reload restaura configuração via URL;
- nova navegação sem URL restaura via storage;
- link inválido abre baseline sem reutilizar storage antigo;
- material ausente/incompleto é rejeitado;
- restauração PBR é atômica;
- nenhum dado privado aparece no payload;
- testes F0–F5 continuam verdes.
