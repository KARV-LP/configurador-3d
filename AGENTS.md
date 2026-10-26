# Regra de materiais KARV

- `KARV-LP/karv-material-library` é a única fonte oficial de tecidos, estampas e demais materiais.
- Toda solicitação de inclusão ou atualização de material deve alterar o repositório `karv-material-library` no mesmo trabalho. Não publique arquivos de material dentro deste repositório.
- Este repositório pode manter ferramentas de processamento e o código consumidor, mas os arquivos finais devem ficar em `karv-material-library/public/v1/assets/<material-id>/` e a entrada pública em `karv-material-library/public/v1/catalog.json`.
- Para mapas por face, publique o conjunto em `public/v1/assets/<material-id>/face-set/` e preserve a regra de que o vivo (`piping`) é derivado por cópia binária de `LATERAL_TOP.webp`.
- Valide primeiro o PR do configurador quando houver mudança de contrato/runtime; depois valide e publique o PR da Biblioteca.
