# Dados do protótipo de Libras

O classificador do navegador carrega somente `treino.json`. Esse arquivo reúne os exemplos de treino válidos e a classe `OUTRA`.

## Estrutura

```text
data/pilot/
├── treino.json                 # conjunto consolidado usado pelo app
├── README.md
└── fontes/
    ├── sessoes/                # conjuntos por sessão usados para gerar treino.json
    └── exportacoes/            # exportações originais, inclusive versões cumulativas
```

Os arquivos em `fontes/` são preservados para rastrear a origem dos dados. O app não os carrega individualmente: algumas exportações incluem capturas anteriores e carregá-las junto causaria duplicação.

## Conjunto atual

`treino.json` contém 2.523 amostras com 21 landmarks cada:

| Classe | Amostras |
|---|---:|
| A | 392 |
| B | 174 |
| C | 203 |
| D | 213 |
| E | 425 |
| F | 263 |
| G | 0 |
| I | 0 |
| L | 164 |
| M | 0 |
| O | 0 |
| Y | 150 |
| OUTRA | 539 |

As 515 amostras válidas A/B/L/Y vieram de `validos-sessao-6.json`; outras 884 amostras C/D/E/F vieram de `validos-sessao-8-cdef.json`. A coleta A/E acrescentou 182 exemplos A e 220 E para ajudar a distinguir essas classes. Uma coleta posterior acrescentou 43 exemplos A feitos com a mão esquerda, após o usuário identificar dificuldade nessa combinação. A exportação CDEF original tinha uma amostra A marcada incorretamente; ela foi excluída do conjunto consolidado e preservada somente no arquivo original em `fontes/exportacoes/`. As 539 amostras OUTRA são poses que devem ser rejeitadas. Foram preservados os metadados exportados; algumas amostras têm lateralidade estimada diferente da mão que a pessoa relatou usar.

Uma exportação posterior, `fontes/exportacoes/libras-landmarks-piloto-2026-10-29 (13).json`, contém 54 amostras OUTRA da sessão `sessao-3-teste`. Por decisão do usuário, foi incluída no treino como `rejeicoes-sessao-7.json`; essas amostras não podem ser usadas como avaliação independente.

## Atualizar o conjunto

1. Coloque a nova sessão rotulada em `fontes/sessoes/` e preserve a exportação original em `fontes/exportacoes/`.
2. Adicione o nome do arquivo à lista `sourceFiles` em `scripts/build-dataset.mjs`.
3. Execute na raiz do projeto:

   ```text
   node scripts/build-dataset.mjs
   ```

4. Confira as contagens exibidas e recarregue o app.

O script valida rótulos, lateralidade, 21 landmarks, coordenadas numéricas e amostras repetidas antes de gerar `treino.json`. Guarde as exportações originais em `fontes/exportacoes/`; não use exportações cumulativas como se fossem sessões distintas.

## Avaliação e próximos passos

Por padrão, novos JSONs adicionados pelo usuário são incorporados ao treino. Arquivos usados no treino não servem para medir desempenho independente, mesmo que a sessão contenha `teste` no nome. Para preservar uma sessão de avaliação, o usuário precisa identificá-la explicitamente como separada antes da integração.

A próxima avaliação independente precisa vir de uma coleta nova, não carregada no classificador, com resultados separados por classe e mão.

G, I, M e O foram escolhidas para a próxima ampliação. Uma referência acadêmica lista H, J, K, X, Y e Z como letras dinâmicas; escolher G/I/M/O como estáticas é uma inferência dessa lista. A interface aceita esses rótulos, mas ainda não há exemplos G/I/M/O no treino, então o app ainda não pode prevê-las.

Após os exemplos A/E, o usuário inicialmente relatou que as previsões passaram nos testes manuais, mas depois identificou dificuldade com A na mão esquerda. Foram adicionados 43 exemplos A/Left e, no reteste, o usuário informou que passou. O resultado é qualitativo, sem contagem de tentativas. O app usa filtro temporal que exige 3 previsões iguais em uma janela de 5 quadros; ainda não há medida quantitativa de desempenho ou atraso.

## Ponto de retomada

O usuário informou que, após incluir os 43 exemplos A/Left, validou e passou. Não temos contagem de tentativas nem métrica independente. A sessão foi pausada depois de preparar a coleta de G, I, M e O: os botões e rótulos estão no app, mas essas classes ainda têm zero amostras no treino. O próximo passo é conferir as configurações das quatro letras, coletar cerca de 30 exemplos por classe equilibrando as mãos e reconstruir `treino.json`. O k-NN usa 7 vizinhos e o filtro temporal mostra uma previsão quando a mesma classe aparece em 3 dos últimos 5 quadros.

O protótipo salva landmarks, rótulos e metadados, não imagens ou vídeo. Obtenha consentimento antes de coletar dados de outras pessoas e guarde apenas o necessário.
