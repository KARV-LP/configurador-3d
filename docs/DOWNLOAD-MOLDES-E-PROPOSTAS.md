# Download dos Moldes e Enviar Proposta

Branch de implementação: `feat/download-moldes-enviar-proposta`.

## Moldes oficiais

O registro tipado `src/templates/mold-registry.ts` é a única fonte usada pela interface para
resolver `surface_id → PDF`. Os arquivos abaixo são cópias byte a byte dos anexos oficiais; nome,
escala, geometria e conteúdo interno não foram alterados.

| `surface_id`     | Nome público             | Arquivo publicado      | SHA-256                                                            |
| ---------------- | ------------------------ | ---------------------- | ------------------------------------------------------------------ |
| `seat`           | Assento                  | `assento.pdf`          | `2ede7c770cb9cfac7e06c9cbd0fff998e8e0f919b5a73d9ae86e831ce28bab9b` |
| `backrest-front` | Encosto Frontal          | `encosto-frontal.pdf`  | `955ad6cfeaf7536cbde6d2aa153fa8e3a67a119885080be7397dd35430823853` |
| `backrest-rear`  | Encosto Traseiro         | `encosto-traseiro.pdf` | `1fcb3a2c1a3a9ef50b457af7d300712208bac02d491a871ce6c2c092afc196f8` |
| `backrest-side`  | Encosto Lateral          | `encosto-lateral.pdf`  | `4525c842d29b9a6655132f513323112e887afc84abdf0d62aa3ce8913e57872e` |
| `side-outer`     | Lateral Externa          | `lateral-externa.pdf`  | `ca3c423adf3be8714bcfcf80744bb15797d16373fa67ad3fe21aec86904884fd` |
| `side-inner`     | Lateral Interna          | `lateral-interna.pdf`  | `2515ff834b6a2e4e49d562255a3a14df461cb5674b726feed7ce37868bc2fb21` |
| `side-top`       | Tira Superior da Lateral | pendente               | pendente                                                           |

O repositório na `main` atual não continha um PDF oficial da Tira Superior da Lateral vinculado à
superfície `side-top` do GLB canônico. A entrada permanece explícita e indisponível; nenhum molde foi
inferido ou gerado. `moldes-oficiais-karv.zip` contém somente os seis PDFs disponíveis.

## Contrato da proposta

O cliente cria o payload `karv.customer-proposal/1` a partir do mesmo estado do `Core3DController`
usado pelo 3D. Cada uma das dez superfícies configuráveis inclui:

- `surfaceId` e nome público;
- origem `original`, `library` ou `custom-art`;
- ID e nome público do Revestimento KARV, quando aplicável;
- nome original e campo do arquivo de `Sua ARTE`, quando aplicável.

O payload também registra o ID, a versão e o SHA-256 da geometria canônica, data do envio, dados do
formulário e referência do snapshot. A captura usa `model-viewer.toDataURL()` na vista atual; câmera,
seleção e materiais não são modificados para produzi-la.

## Armazenamento e atendimento

O endpoint `netlify/functions/submit-proposal.mjs` cria um identificador legível no formato
`KARV-PROP-AAAAMMDDTHHMMSSZ-XXXXXXXX`. O sufixo é aleatório criptograficamente e a criação do
rascunho usa `onlyIfNew`, evitando colisões silenciosas.

Snapshot e arquivos originais são enviados em blocos de até 4 MiB, remontados byte a byte e
persistidos no Netlify Blobs site-wide store `karv-customer-proposals`. A gravação final contém:

```text
<proposal-id>/manifest.json
<proposal-id>/files/snapshot.png
<proposal-id>/files/<surface-id>-<nome-original>
```

Cada arte é limitada a 16 MiB e o conjunto a 48 MiB. PDFs, PNGs e JPEGs são aceitos, alinhado à
validação já usada por `Sua ARTE`. O token temporário de upload não é salvo em texto puro.

Para avisar o atendimento automaticamente, configurar no ambiente de runtime (nunca no bundle):

```text
KARV_PROPOSAL_WEBHOOK_URL=https://endpoint-seguro-da-karv.example/propostas
```

O webhook recebe o ID, data, contato e chave do manifesto; os originais permanecem no Blobs. Se o
webhook ainda não estiver configurado ou falhar, a proposta já persistida continua válida e o
resultado registra o estado da notificação para tratamento operacional. Em outra infraestrutura,
`VITE_KARV_PROPOSAL_ENDPOINT` pode apontar o cliente para um endpoint compatível.

Não há checkout, pagamento ou mudança nos contratos de 3D, Biblioteca KARV, Sua ARTE ou RA.
