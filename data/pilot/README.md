# Dados piloto

Coloque aqui os arquivos JSON exportados pela tela de coleta local.

- `treino-sessao-1.json` contém as amostras A/B/L/Y da sessão 1 usadas pelo primeiro classificador.
- `rejeicoes.json` contém 51 exemplos de treino da classe OUTRA, coletados com a mão esquerda na sessão 2.
- `testedireita.json` contém 74 exemplos de treino da classe OUTRA, todos marcados como mão direita. O nome da sessão exportado inclui `teste`, mas este arquivo foi adicionado ao treino; não o use para medir desempenho independente.
- Uma sessão independente de teste deve ficar em arquivo separado e não ser carregada como treino.
- Não coloque fotos ou vídeos nesta pasta; o protótipo exporta apenas landmarks e rótulos.
- Preserve os JSONs originais. Não misture sessões de treino e teste no mesmo arquivo sem registrar qual sessão é qual.
- Os exemplos OUTRA ampliam a cobertura das duas mãos, mas não comprovam rejeição geral: a variedade de poses dentro dos arquivos ainda precisa ser conferida e a avaliação independente continua pendente.
- Depois de alterar os arquivos de dados, atualize/recarregue a página para o classificador carregar a versão nova.
