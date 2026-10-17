# Organização dos assets

Guarde cada arquivo na pasta de sua finalidade:

| Pasta | Conteúdo |
|---|---|
| `documentos/` | Material de apoio e outros PDFs do projeto |
| `documentos/artigos/` | Artigo da FECCI e referências bibliográficas |
| `imagens/capas/` | Capas do material, artigo e diário Borke |
| `imagens/equipe/` | Fotos dos integrantes em WebP |
| `imagens/logos/` | Logo do Clube Maker e ícone do Fusion |
| `imagens/momentos/` | Registros das atividades em WebP |
| `js/` | Animações da interface e digitalização 3D |
| `modelos/` | Modelo STL do visualizador |

As imagens de origem ficam em `originais/` dentro de cada categoria. Essas
pastas também preservam a logo antiga e as capas de origem. As versões usadas
na página ficam diretamente na pasta da categoria.

## Nomes dos arquivos

Use letras minúsculas, sem espaços ou acentos, com palavras separadas por
hífens: `montagem-banner.jpg`, `aula-ong.jpg`, `material-de-apoio.pdf`.
As versões responsivas levam a largura no nome, como `aula-ong-480.webp` e
`aula-ong-960.webp`. WebP sem sufixo de largura mantém a resolução completa.

## Momentos atuais

Os originais ficam em `imagens/momentos/originais/`:

| Momento | Arquivo original |
|---|---|
| Capacitação da equipe | `capacitacao.jpg` |
| Orientação | `orientacao.jpg` |
| Mentoria Maker | `mentoria-maker.png` |
| Coordenação de Matemática | `coordenacao-matematica.jpg` |
| Montagem do banner | `montagem-banner.jpg` |
| Aula com a ONG | `aula-ong.jpg` |

## Ao adicionar ou substituir arquivos

1. Envie o original para a pasta correspondente, mantendo o padrão de nomes.
2. Atualize as versões WebP quando substituir uma foto. Para momentos, mantenha
   as versões de 480 e 960 pixels de largura, preservando a proporção original.
3. Ajuste `src`, `srcset` e `data-full-src` no `index.html`, conforme o cartão
   existente. Informe as dimensões reais e uma descrição no atributo `alt`.
4. Ao atualizar `documentos/material-de-apoio.pdf`, gere novamente a capa
   `imagens/capas/material-de-apoio.jpg` e atualize o `?v=` da capa e dos links.
5. Confira o site com um servidor local antes de publicar.

Os caminhos no HTML começam por `assets/`; os caminhos deste guia são relativos
a esta pasta. O [manual principal](../README.md) contém os exemplos de código e
o comando para regenerar a capa do material de apoio.
