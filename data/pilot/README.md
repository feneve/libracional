# Dados piloto

Coloque aqui os arquivos JSON exportados pela tela de coleta local.

- `treino-sessao-1.json` contém as amostras A/B/L/Y da sessão 1 usadas pelo primeiro classificador.
- `rejeicoes.json` contém exemplos de treino da classe OUTRA, coletados na sessão 2; o protótipo os combina com o conjunto A/B/L/Y.
- Uma sessão independente de teste deve ficar em arquivo separado e não ser carregada como treino.
- Não coloque fotos ou vídeos nesta pasta; o protótipo exporta apenas landmarks e rótulos.
- Preserve os JSONs originais. Não misture sessões de treino e teste no mesmo arquivo sem registrar qual sessão é qual.
- O classificador ainda precisa de exemplos OUTRA; sem eles, poses fora das quatro letras podem ser confundidas com A/B/L/Y.
- Depois de alterar os arquivos de dados, atualize/recarregue a página para o classificador carregar a versão nova.
