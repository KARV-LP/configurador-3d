# F3 — Integração da Biblioteca KARV 2.0

## Fonte oficial

O configurador consome exclusivamente o contrato público versionado:

`KARV-LP/karv-material-library/public/v1/catalog.json`

Endpoint runtime padrão:

`https://raw.githubusercontent.com/KARV-LP/karv-material-library/main/public/v1/catalog.json`

O configurador **não** consome `catalog/fabrics.json`, `metadata.json` técnico, staging, paths de fornecedor ou fontes editoriais.

## Jornada

Tecidos: `Cor → Material → Tecido`.

KARV Design: canal separado `karv_design`. O contrato suporta o canal mesmo quando ainda não há criações publicadas.

## Validação e segurança

Cada item é validado antes de entrar na UI. Campos fora do contrato público, IDs não KARV, assets fora do namespace público, materiais não publicados, incompatíveis ou PBR marcados como prontos sem mapas obrigatórios são rejeitados.

A aplicação recebe apenas metadata pública. Fornecedor, referência comercial, custo, fontes de pesquisa e metadata editorial não fazem parte dos tipos nem do payload aceito.

## Cache e degradação

1. tenta o catálogo oficial com `no-cache`;
2. valida o contrato e os materiais;
3. somente um catálogo sem itens rejeitados é salvo em `localStorage`;
4. em falha de rede, tenta o último cache validado;
5. sem cache, a Biblioteca mostra estado indisponível e o Core 3D continua carregando e operando.

## Assets

F3 carrega apenas `preview.webp` para descoberta. `base-color`, Normal e AO não são aplicados nesta fase. A aplicação PBR real e a gestão de memória/GPU pertencem à F4.

## Dependência externa

A F3 só pode ser mergeada após a aprovação do contrato público v1 no repositório `karv-material-library`.
