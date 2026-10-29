# Projeto de estudo: aplicativo local de reconhecimento de Libras

> Roteiro de construção passo a passo. Atualizar o checklist e o registro de decisões ao concluir cada etapa, para que o projeto possa ser retomado em outra sessão.

**Última atualização:** 28/10/2026  
**Status geral:** Protótipo web local funcional: webcam, landmarks e classificador A/B/L/Y/OUTRA já foram experimentados pelo usuário. Após adicionar exemplos OUTRA da mão direita, o usuário relatou melhora nessa mão, mas ainda há previsões erradas em algumas poses com ambas as mãos. A avaliação independente ainda está pendente.  
**Objetivo:** construir um protótipo local de estudo que use a câmera do celular para reconhecer algumas letras estáticas do alfabeto manual de Libras.

---

## 1. Objetivo e limites

Vamos construir um aplicativo de estudo que:

1. abra a câmera do celular;
2. detecte uma mão;
3. reconheça algumas letras estáticas escolhidas para o MVP;
4. mostre a letra reconhecida na tela;
5. depois, permita confirmar letras e formar uma mensagem curta.

O reconhecimento deverá acontecer localmente no aparelho ou no computador durante os primeiros experimentos. Não vamos depender de um serviço de inferência em nuvem nem publicar o aplicativo nas lojas. O foco é aprender e validar cada parte.

### O que este projeto não pretende fazer no MVP

- Traduzir conversas ou frases completas em Libras.
- Reconhecer todos os sinais, variações regionais e movimentos da Libras.
- Substituir intérpretes ou ferramentas profissionais de acessibilidade.
- Garantir precisão antes de coletarmos dados e avaliarmos os resultados.

O alfabeto manual tem letras que dependem de movimento. No primeiro MVP, escolheremos letras que possam ser representadas por uma pose estática. Letras dinâmicas poderão ser estudadas numa etapa futura.

---

## 2. Decisões atuais

- **Tipo de projeto:** protótipo local de estudo, sem publicação em lojas.
- **Custo pretendido:** R$ 0 em serviços e ferramentas, usando opções gratuitas e execução local.
- **Escopo inicial:** poucas letras estáticas, não o alfabeto inteiro.
- **Caminho técnico inicial a avaliar:** MediaPipe para localizar pontos da mão e um classificador próprio para reconhecer as letras.
- **Onde o classificador roda:** dentro do navegador, no mesmo protótipo web; sem backend e sem enviar frames para serviço de inferência.
- **Classificador do piloto:** k-NN (k vizinhos mais próximos) sobre landmarks normalizados. O código está em `classifier.js`; o conjunto de referência fica em `data/pilot/treino-sessao-1.json`.
- **Roboflow:** opcional para aprender organização/anotação de imagens e experimentar treinamento. Não é requisito e não usaremos inferência hospedada como dependência do app.
- **Teachable Machine:** possível exercício rápido para entender classificação, não decisão de arquitetura final.
- **Execução:** começar pelo ambiente que estiver disponível; confirmar sistema operacional, celular e ferramentas antes de escolher framework definitivo.
- **Modo de trabalho:** explicar conceitos e escolhas; implementar pequenas partes; revisar o resultado com o usuário; marcar etapas concluídas somente quando houver evidência prática.

### Por que MediaPipe + classificador é uma hipótese inicial

O MediaPipe consegue detectar a mão e devolver pontos de referência. Isso não significa que já reconhece Libras: será necessário criar ou treinar uma etapa que relacione os pontos a cada letra. A vantagem esperada é testar visão em tempo real sem enviar cada frame para a nuvem. Vamos confirmar se esta abordagem funciona para nosso conjunto de letras antes de comprometer o projeto inteiro com ela.

### Como o MediaPipe processa a webcam neste protótipo

Neste projeto, MediaPipe é uma **biblioteca/API de programação**, não um endpoint de nuvem que recebe as imagens. “API” aqui significa as funções e métodos que nosso código chama para usar a biblioteca. O processamento de cada frame acontece dentro do navegador.

O fluxo atual é:

```text
Webcam
  → elemento <video> da página
  → loop de quadros enquanto a detecção está ativa
  → handLandmarker.detectForVideo(video, timestamp)
  → modelo MediaPipe calcula os landmarks no navegador
  → resultado volta ao nosso JavaScript
  → drawHand(...) desenha pontos e linhas no <canvas>
```

O DOM é a estrutura da página que contém elementos como `<video>` e `<canvas>`; ele não é o processador do modelo. O método `detectForVideo` recebe o elemento de vídeo e o instante do quadro. O MediaPipe prepara os pixels internamente, executa os modelos e devolve os resultados. Não precisamos converter manualmente a imagem numa matriz. Por dentro, o modelo usa operações numéricas sobre os pixels.

O Hand Landmarker retorna 21 landmarks por mão:

- `0`: pulso;
- `1–4`: base, articulações e ponta do polegar;
- `5–8`: articulações e ponta do indicador;
- `9–12`: articulações e ponta do dedo médio;
- `13–16`: articulações e ponta do anelar;
- `17–20`: articulações e ponta do mínimo.

Cada ponto contém coordenadas `x`, `y` e `z`. O resultado inclui também a lateralidade estimada (mão esquerda ou direita). A aplicação desenha os pontos e as conexões sobre a imagem para podermos inspecionar a detecção.

Ao clicar em **Detectar mão**, o navegador baixa o pacote JavaScript/WebAssembly e o modelo. Depois, os quadros da webcam são processados localmente; o código do protótipo não envia os quadros para um servidor. Sem internet na primeira execução, o carregamento pode falhar; uso offline completo ainda não foi preparado.

O MediaPipe **não classifica as letras A, B, L e Y**: ele só detecta a mão e seus pontos. O protótipo agora tem uma segunda etapa: um classificador k-NN compara os 21 pontos normalizados com exemplos rotulados e produz uma letra provável. Mais adiante podemos suavizar previsões entre vários quadros. Isso continua sendo reconhecimento de letras isoladas, não tradução de Libras.

### Onde ficará o classificador

O classificador já foi implementado para o piloto. A arquitetura local é:

```text
camera.js: recebe os landmarks atuais do MediaPipe
        ↓
classifier.js: normaliza pontos e compara com exemplos rotulados
        ↓
arquivo JSON: contém os exemplos usados pelo classificador
        ↓
interface: mostra A, B, L ou Y, ou “incerto/sem mão”
```

Para o piloto usamos k-NN (*k-nearest neighbors*, ou k vizinhos mais próximos). Em vez de treinar uma rede neural, o algoritmo guarda os exemplos rotulados de treino. Para uma nova mão, compara seus landmarks normalizados com os exemplos e escolhe a classe mais comum entre os cinco mais próximos. Com apenas quatro classes e um conjunto pequeno, é uma escolha simples de inspecionar e executar no navegador. O arquivo de teste deve permanecer separado e não entrar nessa comparação durante a avaliação.

Isso significa que “treinar” o k-NN é preparar e guardar os exemplos de referência; o cálculo da classe acontece no aparelho/navegador quando uma nova pose chega. `classifier.js` e o JSON já existem no projeto. Se o conjunto inicial mostrar que k-NN não atende, poderemos comparar outro classificador depois.

No código atual, o loop chama `detectForVideo` em [camera.js](camera.js) apenas quando a detecção está ativa. A página ainda usa um botão separado para ligar a detecção depois da câmera, para podermos testar cada parte independentemente; tecnicamente, também seria possível iniciar o detector automaticamente após a câmera ligar.

---

## 3. Plano de etapas e checklist

Uma etapa só recebe `[x]` quando o resultado indicado foi alcançado e conferido. Se uma decisão mudar, registrar em **Registro de decisões e progresso**.

### Etapa 0 — Preparar o ambiente e delimitar o MVP

- [ ] Confirmar sistema operacional e ferramentas disponíveis para desenvolver.
- [x] Confirmar que há webcam no notebook para o primeiro protótipo.
- [x] Escolher uma aplicação web local para começar, deixando o teste no celular para depois.
- [ ] Confirmar o celular de teste (Android/iPhone) para uma etapa posterior.
- [x] Definir as classes iniciais do primeiro teste: A, B, L e Y.
- [x] Conferir as formas corretas dessas letras em uma referência confiável de Libras antes de coletar dados.
- [x] Definir o que conta como sucesso do primeiro protótipo: em teste controlado, classificar A/B/L/Y em pelo menos 4 de 5 tentativas por letra usando uma sessão de teste separada da coleta de treino; quando não houver mão, não inventar uma letra.

**Resultado verificável:** decisões de plataforma e classes registradas neste documento.

**Observação sobre a meta:** esse limiar é uma meta didática inicial para uma demonstração controlada, não uma alegação de precisão geral. Um teste com uma única pessoa não demonstra que o modelo funcionará para outras pessoas.

### Etapa 1 — Câmera e tela mínima

- [x] Criar a estrutura mínima do aplicativo/protótipo web (`index.html`, `styles.css` e `camera.js`).
- [x] Pedir permissão da câmera de forma apropriada.
- [x] Mostrar a imagem ao vivo.
- [ ] Mostrar estados claros: aguardando permissão, câmera ativa e erro de câmera.

**Resultado verificável:** câmera funciona no dispositivo ou ambiente escolhido, antes de adicionar IA.

### Etapa 2 — Detectar a mão

- [x] Integrar MediaPipe Hand Landmarker no protótipo web local.
- [x] Desenhar os pontos/articulações detectados sobre a imagem.
- [x] Receber confirmação do usuário de que os pontos da mão aparecem na aplicação.
- [x] Confirmar que os pontos acompanham a mão e desaparecem quando a mão sai do enquadramento.
- [x] Começar com uma mão por frame (`numHands: 1`), pois o MVP reconhece uma letra do alfabeto manual por vez.
- [ ] Testar robustez com mão parcialmente visível, distâncias e iluminações diferentes.
- [ ] Registrar limitações e ajustar captura/enquadramento.

**Resultado verificável:** pontos da mão acompanham a mão ao vivo com estabilidade suficiente para experimentar.

**Critério de conclusão da etapa:** no navegador, com a webcam ativa, os pontos acompanham uma mão; ao retirar a mão, os pontos desaparecem; a página continua responsiva. O teste básico foi confirmado pelo usuário; a robustez em diferentes condições segue como validação adicional.

### Etapa 3 — Coletar exemplos e preparar dataset

- [x] Definir instrução simples para capturar uma pose por amostra, com rótulo escolhido manualmente e sessão identificada.
- [x] Validar a tela de coleta e exportação JSON no navegador.
- [x] Coletar pelo menos 30 exemplos de cada letra para um primeiro conjunto de treino.
- [ ] Revisar se as amostras incluem variação natural de enquadramento, distância e iluminação, sem perder a configuração correta.
- [x] Capturar ao menos 20 exemplos de pose visível fora das classes com o rótulo `OUTRA`, numa sessão de treino adicional.
- [ ] Confirmar que os exemplos `OUTRA` cobrem mais de um tipo de pose inválida, sem incluir formas válidas de A/B/L/Y.
- [ ] Coletar pelo menos 5 exemplos por combinação letra/mão (A/B/L/Y × esquerda/direita) numa sessão de teste independente: 40 amostras no total.
- [ ] Incluir exemplos `OUTRA` também na sessão de teste independente; não reutilizar os exemplos de treino para medir acerto.
- [ ] Se houver voluntários, coletar uma sessão adicional com outras pessoas, com consentimento, para avaliar generalização separadamente.
- [ ] Separar os arquivos de treino e teste por sessão/pessoa, evitando capturas quase idênticas nos dois conjuntos.
- [ ] Guardar apenas os dados necessários e obter consentimento de quem participar.

**Resultado verificável:** conjunto rotulado, separado e revisado; quantidade e origem dos dados documentadas.

**Formato piloto:** JSON com classe, nome da sessão, data/hora, mão estimada e 21 coordenadas `x/y/z`. O protótipo não salva imagens. Os dados permanecem em memória na página até o usuário baixar o JSON; atualizar ou fechar antes do download apaga as capturas.

**Como capturar o piloto:** não é necessário enviar imagens. Cada clique num botão salva 21 landmarks e o rótulo escolhido. O primeiro conjunto de treino já tem pelo menos 30 amostras por letra. A classe `OUTRA` significa que há uma mão detectada, mas a pose não corresponde a nenhuma das quatro formas válidas; ausência de mão continua sendo um estado separado. O treino já recebeu uma coleta de OUTRA na sessão 2. Depois, coletar numa sessão independente cinco exemplos de cada letra com cada mão (40 amostras), além de exemplos OUTRA de teste. Não reutilizar a sessão de teste no treino.

### Etapa 4 — Primeiro classificador

- [x] Normalizar os pontos da mão para reduzir efeitos de posição e escala.
- [x] Implementar um k-NN simples com as classes escolhidas.
- [x] Ligar o k-NN ao fluxo ao vivo e mostrar a previsão ou incerteza.
- [x] Mostrar percentual de concordância dos cinco vizinhos, com aviso de que não é probabilidade calibrada.
- [x] Adicionar uma classe `OUTRA` ao conjunto usado pelo classificador, para permitir rejeição aprendida de poses fora de A/B/L/Y.
- [ ] Conferir as previsões ao vivo em poses novas; elas ainda são exploratórias.
- [ ] Avaliar em exemplos que não entraram no treino, por letra e por mão.
- [ ] Criar matriz de confusão ou tabela dos erros por letra.
- [ ] Corrigir dados ou representação se houver confusões recorrentes.

**Resultado verificável:** métricas e exemplos de acerto/erro registrados. Não avançar com base apenas em exemplos de treino.

### Etapa 5 — Estabilizar o reconhecimento ao vivo

- [x] Executar classificador junto da câmera.
- [x] Mostrar classe e indicador de incerteza.
- [ ] Adicionar filtro temporal para reduzir oscilações entre previsões.
- [x] Mostrar estado “mão não detectada” ou “sinal incerto”.
- [ ] Medir se a experiência responde em tempo útil no dispositivo disponível.

**Resultado verificável:** previsões ao vivo ficam estáveis o suficiente para uma demonstração controlada.

### Etapa 6 — Compor texto

- [ ] Adicionar ação explícita de confirmar a letra.
- [ ] Adicionar espaço, apagar último caractere e limpar mensagem.
- [ ] Evitar inserir várias letras acidentalmente enquanto a pose permanece na câmera.
- [ ] Testar a sequência de uso completa.

**Resultado verificável:** formar e editar uma palavra curta usando as letras reconhecidas.

### Etapa 7 — Revisão e próximos experimentos

- [ ] Fazer teste com pessoas diferentes das usadas na coleta, se disponível.
- [ ] Registrar falhas, condições de uso e limitações observadas.
- [ ] Pedir revisão de uma pessoa fluente em Libras para as classes e instruções.
- [ ] Decidir se ampliamos letras, estudamos sinais dinâmicos ou encerramos como protótipo de estudo.

**Resultado verificável:** relatório curto com o que funciona, o que falha e qual experimento faz sentido em seguida.

---

## 4. Critério de aprendizado

Em cada etapa, além de fazer funcionar, vamos registrar em poucas linhas:

- **O que construímos?**
- **Que conceito novo foi usado?**
- **Como verificamos que funciona?**
- **Que erro ou dúvida apareceu?**
- **Qual é o próximo passo?**

O assistente deve explicar o propósito do código e evitar despejar uma solução grande sem contexto. Não marcar etapas como concluídas apenas porque o código foi escrito; é preciso executar ou revisar uma evidência compatível com o critério.

---

## 5. Ferramentas e custos

### Opção principal em avaliação: MediaPipe e classificador local

MediaPipe pode detectar landmarks da mão em imagem, vídeo e fluxo ao vivo. Ele cobre a localização dos pontos; o reconhecimento das classes de Libras será uma parte própria do projeto. Executar localmente reduz dependência de internet e chamadas pagas.

### Roboflow gratuito

Pode ser usado para organizar imagens, anotar e experimentar treinamento. A página oficial consultada em 26/10/2026 informa uma camada gratuita com créditos mensais e execução local pelo Roboflow Inference sem consumo de créditos. A inferência hospedada na nuvem usa créditos, então não será a base da câmera em tempo real. Modelos e licenças variam; conferir os termos do modelo escolhido antes de incorporar.

### Teachable Machine

Pode servir para uma experiência didática de classificação de imagens e exportação de modelo. Não foi escolhido como arquitetura final.

### Edge Impulse

O plano Developer é gratuito para prototipagem, mas a página de preços diferencia pesquisa/desenvolvimento interno de distribuição externa. Como o projeto não será publicado, pode ser avaliado; conferir os termos aplicáveis quando escolhermos o fluxo.

### Custos fora do escopo atual

Como não vamos publicar o app, taxas das lojas não fazem parte do plano. Se a decisão mudar, revisar preços e condições vigentes antes de publicar. O custo de dados móveis e inferência em nuvem é evitável mantendo o processamento local.

---

## 6. Fontes oficiais consultadas

Consultadas em 26/10/2026; planos e limites podem mudar.

- [Roboflow Pricing](https://roboflow.com/pricing)
- [Roboflow: mudanças de preço e inferência local](https://roboflow.com/blog/making-it-easier-cheaper-to-deploy-with-roboflow)
- [Roboflow Credits](https://roboflow.com/credits)
- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
- [MediaPipe Hand Landmarker API](https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/HandLandmarkerOptions)
- [Google Teachable Machine](https://dev.teachablemachine.withgoogle.com/)
- [Edge Impulse Pricing](https://www.edgeimpulse.com/pricing)
- [Google Colab FAQ](https://research.google.com/colaboratory/faq.html)
- [INES — Alfabeto de Libras e Configuração de Mãos](https://www.gov.br/ines/pt-br/central-de-conteudos/publicacoes-1/todas-as-publicacoes/alfabeto-manual-e-configuracao-de-maos)
- [Centro Paula Souza/SIA — Alfabeto Manual em Libras, com imagem do alfabeto](https://sia.cps.sp.gov.br/alfabeto-manual-em-libras/)
- [MediaPipe Hand Landmarker para Web/JavaScript](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [MediaPipe Hands — nota sobre handedness e entrada espelhada](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/hands.md?plain=1)

---

## 7. Registro de decisões e progresso

### 2026-10-26 — Plano inicial definido

- **Decisão:** desenvolver como objeto local de estudo, sem publicação em lojas.
- **Decisão:** manter a meta inicial pequena: reconhecer algumas letras estáticas de Libras.
- **Decisão:** avançar por etapas e explicar conceitos para apoiar o aprendizado do estagiário.
- **Decisão:** manter este arquivo como fonte de continuidade; marcar cada etapa concluída e registrar mudanças.
- **Situação:** nenhuma etapa técnica marcada como concluída. A inspeção da pasta encontrou apenas este documento de planejamento; não há código do aplicativo ainda.
- **Próximo passo:** concluir a Etapa 0, confirmando ambiente/plataforma e selecionando as primeiras letras.

### 2026-10-26 — Início do protótipo web

- **Ambiente observado:** pasta sem código pré-existente; Node.js e Python 3 disponíveis.
- **Decisão:** usar a webcam do notebook e uma página web local como primeiro protótipo. Isso permite aprender câmera e permissões antes de lidar com a depuração USB no celular.
- **Implementado:** página de laboratório com interface em português; botão para iniciar/desligar webcam; solicitação de permissão pelo navegador; estados de erro; vídeo espelhado; aviso de que nenhuma imagem é gravada ou enviada. O front-end não usa biblioteca nem fonte externa.
- **Arquivos:** `index.html`, `styles.css`, `camera.js`.
- **Checklist:** Etapa 0 parcialmente concluída. Etapa 1: estrutura criada; permissão e exibição da imagem ainda precisam ser confirmadas pelo usuário no navegador.
- **Como abrir para conferência:** no terminal, dentro da pasta do projeto, executar `python3 -m http.server 8000` e abrir `http://localhost:8000` no navegador. O servidor deve ficar rodando enquanto a página estiver em uso.
- **Nota do ambiente desta sessão:** a tentativa de iniciar um servidor pela ferramenta de execução foi impedida pelo sandbox ao abrir uma porta local (`PermissionError`). O usuário pode iniciá-lo no próprio terminal; isso não indica erro no aplicativo.
- **Não concluído:** nenhuma classe de Libras foi escolhida e nenhuma inferência de visão computacional foi integrada.
- **Próximo passo:** abrir a página servida em `localhost`, permitir a câmera e confirmar se a imagem aparece. Depois registrar o resultado e escolher as primeiras letras.

### 2026-10-26 — Webcam confirmada pelo usuário

- **Resultado informado:** a página abriu pelo botão Run and Debug do VS Code, solicitou/acessou a webcam e o vídeo funcionou.
- **Checklist:** Etapa 1, permissão e imagem ao vivo concluídas. Estados de erro da câmera ainda não foram testados.
- **Esclarecimento:** iniciar pelo VS Code não altera o código do aplicativo; é apenas uma forma de abrir a página durante o desenvolvimento. Não há configuração `.vscode` no projeto, então não consigo afirmar qual extensão/comando do VS Code abriu a página. Quando for conveniente, conferir se a barra do navegador mostra `http://localhost...` ou `http://127.0.0.1...`; se mostrar `file://`, a câmera ainda funcionou nesse navegador, mas usaremos um servidor local para as próximas integrações.
- **Ambiente relatado:** PowerShell do Windows não reconheceu `python` e sugeriu Microsoft Store. O `python3` encontrado na sessão do assistente pertence ao ambiente Linux/WSL e não significa que o comando `python` esteja instalado no Windows.
- **Próximo passo:** continuar a Etapa 0 escolhendo de 3 a 5 letras estáticas e definindo sucesso do protótipo de reconhecimento. Depois avançar para detectar a mão.

### 2026-10-26 — Classes iniciais escolhidas

- **Decisão acordada:** as quatro classes do primeiro MVP serão `A`, `B`, `L` e `Y`.
- **Motivo:** começar com poucas poses estáticas e com configurações de mão variadas, para observar se o pipeline consegue distinguir formas diferentes sem aumentar demais a coleta e a análise de erros.
- **Escopo:** `J` e `Z` ficam para uma etapa posterior por envolverem movimento no alfabeto manual; o primeiro classificador vai tratar poses estáticas.
- **Cuidado:** esta seleção é uma escolha prática de escopo, não uma afirmação de que essas sejam necessariamente as letras mais fáceis ou mais representativas. Antes da coleta, verificar as configurações de mão de Libras numa referência confiável.
- **Checklist:** número e classes iniciais definidos; confirmação visual das formas ainda pendente.
- **Próximo passo:** definir o critério de sucesso do protótipo e, antes de treinar, validar como representar e coletar exemplos dessas quatro letras.

### 2026-10-26 — Critério de sucesso e detector de mão

- **Meta didática definida:** numa demonstração controlada, buscar pelo menos 4 acertos em 5 tentativas para cada uma das quatro letras em uma sessão separada da coleta de treino, e não exibir uma letra se não houver mão. Esta meta não mede generalização para outras pessoas.
- **Referência para conferir as formas:** página de publicações do INES que disponibiliza o alfabeto manual e configurações de mãos. O conteúdo visual da página não foi conferido nesta sessão; antes da coleta, validar cada configuração com o material do INES e, se possível, uma pessoa fluente em Libras.
- **Implementado:** início da Etapa 2 no protótipo; botão separado para ligar/desligar MediaPipe Hand Landmarker; sobreposição de landmarks e indicação de 21 pontos/não detectado; processamento de frames feito na página do navegador.
- **Dependência de rede:** na primeira utilização, o navegador baixa o pacote JavaScript, o WebAssembly e o arquivo de modelo de CDN/Google. O código de detecção roda no navegador; os frames da webcam não são enviados pelo código do app. Após baixar, disponibilidade offline não foi configurada nem verificada.
- **Ainda pendente:** testar MediaPipe no navegador do usuário, conferir responsividade e desaparecimento dos pontos quando a mão sai do quadro. Nenhuma letra é reconhecida ainda.
- **Próximo passo:** usuário abrir pelo mesmo fluxo do VS Code, ligar câmera e clicar “Detectar mão”; observar pontos e relatar se funcionou ou copiar qualquer mensagem de erro.

### 2026-10-26 — Primeira confirmação de landmarks

- **Evidência relatada pelo usuário:** os pontos da mão aparecem na aplicação.
- **Checklist:** integração e visualização confirmadas. Ainda falta observar se os pontos acompanham a mão quando ela se move e desaparecem quando a mão sai do quadro; portanto, a Etapa 2 continua aberta.
- **Referência de Libras localizada:** o INES disponibiliza uma publicação intitulada “Alfabeto de Libras e Configuração de Mãos”, com links para o alfabeto manual e uma lista de configurações de mão. A validação visual de A/B/L/Y continua pendente antes da coleta.
- **Próxima ação:** fazer o teste curto de mover a mão para os lados e retirá-la do enquadramento. Depois, se os pontos acompanharem e sumirem corretamente, concluir a detecção básica e planejar a coleta das quatro letras.

### 2026-10-26 — Rastreamento básico confirmado

- **Evidência relatada pelo usuário:** os pontos acompanham a mão em movimento e somem quando ela sai do enquadramento.
- **Resultado:** critério funcional básico da Etapa 2 concluído no notebook do usuário.
- **Pendente como validação adicional:** mão parcialmente visível, diferentes distâncias e condições de iluminação.
- **Próximo passo:** validar as configurações de mão A/B/L/Y na referência do INES antes de planejar a coleta e o treinamento do classificador.

### 2026-10-26 — Referências para validar o alfabeto

- **Fonte institucional principal:** o INES mantém uma página com downloads do alfabeto manual e de configurações de mãos.
- **Fonte institucional complementar:** a Superintendência de Inclusão e Acessibilidade do Centro Paula Souza apresenta o alfabeto manual e uma imagem A–Z+Ç, com referências bibliográficas associadas.
- **Limite da checagem nesta sessão:** a página do INES bloqueou a leitura automatizada com uma verificação de CAPTCHA; consegui confirmar que os downloads existem, mas não examinei visualmente as figuras. A imagem do Centro Paula Souza está disponível no navegador, porém não foi possível validar visualmente a orientação das quatro poses nesta sessão.
- **Checklist:** as letras A/B/L/Y continuam escolhidas, mas suas formas/orientações ainda precisam de conferência antes de rotular dados. Não coletar exemplos rotulados até essa validação.
- **Próximo passo:** consultar a prancha do alfabeto nas referências acima e confirmar com uma pessoa fluente em Libras se possível; em seguida, montar a tela de coleta de landmarks por classe.

### 2026-10-26 — Formas das classes confirmadas pelo usuário

- **Evidência relatada:** o usuário abriu a tabela de referência do alfabeto manual e confirmou que as configurações escolhidas A, B, L e Y estão corretas.
- **Checklist:** validação das quatro classes marcada como concluída antes de rotular amostras.
- **Próximo passo:** fazer coleta piloto de landmarks, começando pela validação da tela de coleta no navegador.

### 2026-10-26 — Tela de coleta piloto criada

- **Objetivo didático:** transformar a detecção de pontos em dados rotulados para que, na próxima etapa, possamos treinar e avaliar um classificador.
- **Implementado:** quatro botões de captura manual (A/B/L/Y), campo para nomear a sessão, contagem de amostras por classe, exportação em JSON e opção de apagar a coleta atual.
- **Conteúdo salvo por amostra:** 21 pontos (`x/y/z`), classe selecionada, sessão, horário e lateralidade estimada. Nenhum frame/imagem é salvo.
- **Privacidade/limite:** a coleta fica somente na memória da página até baixar o JSON. Atualizar/fechar a página antes de exportar perde os dados. Nenhuma amostra foi coletada nesta sessão.
- **Protocolo piloto sugerido:** 30 amostras por classe distribuídas em três sessões; sessões 1 e 2 para treino (20 por classe), sessão 3 para teste (10 por classe). Isso gera apenas uma avaliação didática da pessoa que coletou, não mede generalização para outras pessoas.
- **Esclarecimento de coleta:** “amostra” aqui significa os 21 pontos (com coordenadas), não uma imagem enviada. Variar distância, posição e iluminação moderadamente, sem deformar ou inverter a configuração correta do sinal; refazer a pose entre capturas para não registrar frames quase idênticos.
- **Checklist:** rótulos e protocolo definidos; tela/exportação ainda precisam ser conferidos pelo usuário no navegador.
- **Próximo passo:** atualizar a página, ativar câmera e MediaPipe, capturar uma amostra de teste e baixar o JSON para conferir a estrutura antes de fazer a coleta piloto completa.

### 2026-10-26 — Destino do JSON de teste

- **Decisão operacional:** guardar o JSON exportado pela tela em `data/pilot/` dentro do projeto.
- **Pasta preparada:** `data/pilot/README.md` descreve a finalidade e os cuidados com os arquivos.
- **Situação:** o usuário informou que capturou e baixou o arquivo; ele ainda precisa copiá-lo para a pasta do projeto para ser inspecionado. Até lá, a estrutura não foi verificada e não se inicia a coleta completa.

### 2026-10-26 — Primeiro conjunto de landmarks inspecionado

- **Arquivo:** `data/pilot/treino-sessao-1.json`, organizado a partir do JSON que o usuário colocou na raiz do projeto e renomeado para explicitar seu uso como treino.
- **Resultado estrutural:** JSON válido, versão 1, classes A/B/L/Y, 140 amostras equilibradas (35 por classe), cada amostra com 21 landmarks e coordenadas `x/y/z` numéricas finitas. Os campos não contêm imagens ou frames.
- **Limite de avaliação:** todas as 140 amostras pertencem à sessão `sessao-1`. Não dividir aleatoriamente esse mesmo conjunto entre treino e teste, pois capturas feitas na mesma sessão podem ser parecidas e inflar a avaliação.
- **Uso planejado:** manter este arquivo como conjunto inicial de treino; capturar ao menos 10 amostras de cada classe numa sessão diferente para teste independente.
- **Metadado de mão:** o JSON contém 84 rótulos `Left` e 56 `Right`. O usuário confirmou que alternou as mãos; ainda vamos conferir se as categorias do MediaPipe estão consistentes por pose antes de usá-las para canonicalizar landmarks.
- **Uso das mãos confirmado pelo usuário:** houve alternância intencional entre as duas mãos. Distribuição registrada pelo MediaPipe: A=`Left` 31 / `Right` 4; B=21/14; L=14/21; Y=18/17. A distribuição por letra não é equilibrada, então verificar/canonicalizar a lateralidade dos landmarks antes de depender desses rótulos no classificador.
- **Plano de teste atualizado:** avaliar as duas mãos separadamente na sessão 2; como primeiro teste didático, capturar ao menos 5 amostras de cada combinação letra/mão (A/B/L/Y × esquerda/direita), totalizando 40. Se o resultado variar muito, ampliar o conjunto.
- **Situação:** amostras adequadas estruturalmente para iniciar um classificador exploratório; diversidade visual ainda não pode ser avaliada porque o arquivo guarda pontos, não imagens.
- **Próximo passo:** revisar como as capturas foram feitas (uma ou duas mãos, variações entre poses) e então implementar/ajustar a normalização e o k-NN usando este conjunto como treino.

### 2026-10-26 — Local proposto para o classificador

- **Estado atual:** ainda não existe classificador; a tela coleta e exporta exemplos, e o MediaPipe apenas detecta landmarks.
- **Proposta para o piloto:** executar o reconhecimento em JavaScript no navegador; manter o algoritmo num módulo `classifier.js` e os landmarks de treino num arquivo JSON separado.
- **Algoritmo inicial recomendado:** k-NN sobre landmarks normalizados. É pequeno, não exige um servidor nem treinamento de uma rede neural, e permite inspecionar por que exemplos foram considerados próximos.
- **Separação de avaliação:** exemplos da sessão de teste não serão incluídos no JSON de referência usado pelo classificador.
- **Status:** decisão técnica provisória; implementar depois de validar a tela de captura e obter um pequeno dataset.

### 2026-10-26 — Conceito do fluxo MediaPipe explicado

- **Aprendizado registrado:** neste protótipo, MediaPipe é uma biblioteca/API usada no navegador, não um serviço de inferência que recebe frames. `detectForVideo(video, timestamp)` recebe o vídeo e o tempo do quadro; a biblioteca executa o modelo no browser e devolve landmarks ao JavaScript.
- **Distinção importante:** o DOM organiza elementos da página; a inferência acontece na biblioteca executada pelo navegador. Os pixels são preparados internamente, sem conversão manual de imagem para matriz pelo nosso app.
- **Anatomia registrada:** 21 pontos = pulso (1) + quatro pontos por dedo (20); as articulações representadas diferem um pouco no polegar.
- **Relação com Libras:** MediaPipe localiza a mão; um classificador próprio terá de mapear exemplos de landmarks para A/B/L/Y. Detecção de pontos e classificação de letras são etapas diferentes.

### 2026-10-26 — Verificação da lateralidade do MediaPipe

- **Observação técnica:** no protótipo, o vídeo é espelhado apenas por CSS para a prévia; `detectForVideo` recebe o elemento `<video>` original, sem espelhamento dos pixels.
- **Referência:** a documentação oficial da solução antiga MediaPipe Hands diz que `Left/Right` presume entrada espelhada; se a imagem não for espelhada, a aplicação deve inverter essa categoria. O guia atual do Hand Landmarker para Web descreve `handedness`, mas não traz essa ressalva explicitamente. Não presumir que o comportamento é idêntico sem observar na versão usada.
- **Mudança feita:** a mensagem da aplicação agora mostra a lateralidade estimada pelo MediaPipe como “ainda em validação”.
- **Próximo passo imediato:** com a câmera ativa, mostrar uma mão física por vez (direita e depois esquerda) e anotar qual categoria aparece. Não usar o campo `handedness` no k-NN até validar a correspondência.

### 2026-10-26 — Lateralidade verificada no notebook

- **Evidência do usuário:** mão esquerda física aparece como `Left`; mão direita física aparece como `Right`.
- **Conclusão local:** nessa câmera, navegador e versão atual, não precisamos inverter o metadado de lateralidade. Manter a verificação se a origem de vídeo mudar.
- **Dados:** o usuário confirmou que alternou as mãos durante as 140 capturas; os totais por classe refletem o padrão efetivamente coletado, embora algumas combinações classe/mão sejam menos representadas.

### 2026-10-26 — Primeiro k-NN local implementado

- **Arquivos:** `classifier.js` (normalização e votação k-NN), `camera.js` (carregamento do JSON e previsão ao vivo), `index.html` e `styles.css` (exibição da previsão).
- **Normalização:** subtrai o pulso para remover a posição da mão, escala pela distância pulso–base do dedo médio para reduzir efeito de tamanho/distância e espelha horizontalmente uma lateralidade para comparar as mãos numa orientação comum.
- **Predição:** compara 63 valores normalizados (21 pontos × `x/y/z`) com as amostras da sessão 1, escolhe os cinco vizinhos mais próximos e mostra a letra se pelo menos três concordarem; caso contrário, mostra `?`.
- **Limite:** o classificador usa as mesmas 140 amostras que agora compõem sua referência. A previsão na tela demonstra o fluxo, mas não mede precisão independente. Ainda falta sessão de teste separada com as duas mãos.
- **Checklist:** implementação concluída; ainda não foi conferida no navegador do usuário. Nenhuma métrica de acerto foi calculada.
- **Próximo passo:** atualizar a página, ligar câmera e detecção e observar as previsões de A/B/L/Y em poses refeitas. Anotar acertos/erros sem interpretar como validação formal; depois coletar teste independente.

### 2026-10-26 — Primeiras previsões e limites observados pelo usuário

- **Mãos simultâneas:** o detector está configurado com `numHands: 1`, então processa uma mão por quadro. Isso corresponde ao MVP de uma letra por vez; durante a coleta, mostrar somente a mão cuja amostra será rotulada. Alternar entre mãos em capturas separadas continua permitido.
- **Comportamentos relatados:** A em orientação normal/sideways foi reconhecida, mas invertida virou Y; mão aberta foi classificada como B; B correto foi reconhecido; dedos pouco flexionados em L viraram A; L correto foi reconhecido; Y correto foi reconhecido, mas invertido virou A.
- **Interpretação:** o k-NN atual só conhece quatro rótulos e pode escolher o mais próximo mesmo quando a pose está inválida. Ele ainda não aprende uma classe “nenhuma dessas” nem aplica um limite de distância calibrado. As poses invertidas também ficam fora da orientação de referência; não queremos tornar todas as rotações automaticamente equivalentes.
- **Referência visual:** o usuário já conferiu a tabela A/B/L/Y. Não é necessário baixar outra imagem para treinar; uma cópia local pode documentar a referência, mas o modelo usa landmarks. O dataset precisa de exemplos positivos corretos e exemplos negativos/ambíguos rotulados para rejeição.
- **Próximo passo técnico:** revisar e ampliar o classificador para permitir “incerto/nenhuma dessas”, e adicionar essa opção à coleta antes de capturar exemplos negativos. Depois testar de novo com poses corretas e incorretas, mantendo teste independente separado.

### 2026-10-26 — Percentual de concordância na interface

- **Decisão:** mostrar um percentual porque o usuário pediu uma indicação numérica da previsão.
- **Semântica:** o percentual atual é `votos da classe mais votada / 5 vizinhos × 100` (por exemplo, 4/5 = 80% de concordância). Não é probabilidade de acerto e não está calibrado.
- **Implementado:** a interface mostra “Concordância” junto à previsão, e explica que o valor é acordo entre exemplos próximos, não chance calibrada.
- **Para falar em chance/probabilidade no futuro:** avaliar em uma sessão separada e verificar se previsões mostradas como 80% acertam aproximadamente 80% ao longo de muitas amostras. Isso ainda não foi feito.

### 2026-10-26 — Classe OUTRA na coleta

- **Decisão:** adicionar uma classe `OUTRA` para uma mão visível cuja pose não corresponda às formas válidas A/B/L/Y. “Sem mão detectada” permanece estado próprio, não um exemplo OUTRA.
- **Implementado:** botão OUTRA na coleta; contador-alvo inicial de 20 exemplos; exportação inclui a classe; o k-NN aceita esse rótulo e tenta carregar também `data/pilot/rejeicoes.json` quando o arquivo estiver presente.
- **Estado de reconhecimento:** ainda não há exemplos OUTRA no treino. Portanto, apenas adicionar o botão não faz o classificador reconhecer/rejeitar essas poses; após a coleta, o JSON precisa ser copiado para `data/pilot/rejeicoes.json` e o app recarregado.
- **Treino/teste:** capturar exemplos negativos em sessão de treino adicional; a sessão de teste deve ser posterior e permanecer fora do conjunto usado pelo k-NN.
- **Próximo passo:** atualizar a página, definir nome de sessão `sessao-2-treino`, capturar exemplos variados para OUTRA (mão aberta sem o polegar dobrado como B; poses invertidas que não correspondam à referência; L incompleto) e exportar o JSON.

### 2026-10-26 — Coleta OUTRA recebida

- **Arquivo conferido:** `data/pilot/rejeicoes.json`.
- **Estrutura:** 51 amostras, todas rotuladas OUTRA, cada uma com 21 landmarks e coordenadas finitas; sem imagens.
- **Lateralidade:** as 51 aparecem como Left. O usuário informou que coletou várias poses, mas não as catalogou; a diversidade entre tipos não pode ser confirmada no JSON.
- **Metadado corrigido:** o arquivo exportado manteve o valor padrão `sessao-1`; como os timestamps mostram uma coleta posterior ao conjunto anterior, os campos `session` foram corrigidos para `sessao-2-treino`. Rótulos e landmarks não foram alterados.
- **Integração:** o protótipo já carrega `rejeicoes.json` junto do treino principal. Recarregar a página para obter os 191 exemplos no k-NN.
- **Próximo passo:** comparar o comportamento entre mãos e coletar exemplos `OUTRA` da mão direita, além de reservar novas poses para uma sessão de teste independente.

### 2026-10-26 — Primeiro teste da classe OUTRA nas duas mãos

- **Evidência relatada pelo usuário após recarregar o protótipo:** ao repetir poses inválidas usando a mão esquerda, a saída aparece como `OUTRA`; usando a mão direita, algumas dessas poses são classificadas como uma letra conhecida.
- **O que isso demonstra:** o caminho de carregamento e classificação da classe `OUTRA` está funcionando para pelo menos as poses à esquerda experimentadas. Ainda não demonstra boa rejeição geral, nem permite medir uma taxa de acerto.
- **Impedimento observado:** as 51 amostras `OUTRA` de treino estão todas marcadas como `Left`. O conjunto não fornece exemplos dessa classe para a mão direita; isso provavelmente contribui para a diferença observada, mas precisamos testar/coletar para confirmar.
- **Plano de melhoria:** fazer uma coleta adicional de poses `OUTRA` com a mão direita, alternando deliberadamente várias formas inválidas e registrando categorias simples na próxima vez. Em seguida, testar poses novas de ambas as mãos sem misturar os exemplos de teste no treino. Não é necessário refazer as 51 amostras atuais.
- **Estado do projeto:** há um protótipo didático funcional, mas ainda não há evidência suficiente para dizer que o reconhecimento é confiável. As previsões erradas anteriores (por exemplo, poses inválidas confundidas com B/A/Y) seguem como falhas conhecidas a acompanhar.
- **Próximo passo ao retomar:** revisar a interface/contagem depois da atualização e planejar uma sessão curta `OUTRA` para a mão direita; manter as letras de teste numa sessão separada.

### 2026-10-28 — Exemplos OUTRA da mão direita adicionados

- **Arquivo conferido:** `data/pilot/testedireita.json`.
- **Estrutura:** 74 amostras, todas rotuladas `OUTRA`, com 21 landmarks cada e lateralidade `Right`; não há imagens. A sessão registrada no arquivo é `sessao-3-outra-direita teste`.
- **Integração:** o protótipo agora carrega este arquivo junto com `treino-sessao-1.json` e `rejeicoes.json`. A interface informa a quantidade total de exemplos OUTRA e quantos são da mão direita; o conjunto carregado passa a ter 265 amostras.
- **Limite:** isso amplia o treino para a mão direita, mas não prova que o classificador rejeita poses inválidas novas. A palavra `teste` no nome da sessão não torna o arquivo uma avaliação independente; ele está sendo usado no treino.
- **Próximo passo:** recarregar o app e conferir ao vivo poses OUTRA com a mão direita. Depois, coletar teste independente, mantendo os exemplos de teste fora dos três arquivos de treino.

### 2026-10-28 — Melhora percebida e próximos ajustes

- **Evidência relatada pelo usuário:** depois de recarregar e testar, a rejeição melhorou com a mão direita; algumas posições ainda geram previsões incorretas tanto com a esquerda quanto com a direita. Não foram anotadas contagens de acertos/erros, então esta é uma observação qualitativa, não uma métrica.
- **Processo combinado:** continuar alimentando o conjunto de treino com exemplos rotulados em JSON. Antes de capturar um erro, anotar a pose feita, a previsão exibida, a mão usada e o rótulo correto; capturar como `OUTRA` se a pose não corresponder a A/B/L/Y, ou com a letra correta se for uma pose válida classificada errado. Manter os arquivos de teste independente fora do classificador.
- **Limite do processo:** exemplos adicionais podem ajudar o k-NN a cobrir poses parecidas, mas não garantem reconhecimento geral. Repetir a avaliação em poses novas para verificar se a melhora se mantém.
- **Direção futura discutida:** Flutter poderá reutilizar o protótipo web numa WebView ou portar o fluxo para processamento local no app (câmera, MediaPipe e classificador). Não foi tomada decisão de arquitetura; primeiro validar melhor os dados e o reconhecimento no protótipo.
- **Próximo passo:** registrar erros recorrentes e coletar exemplos de treino específicos para eles, sem misturar os dados reservados para avaliação independente.

---

## 8. Instruções para retomar em outra sessão

Ao continuar este projeto:

1. Ler este documento antes de alterar o projeto.
2. Respeitar os checkboxes e decisões registradas; não presumir que etapa não marcada já foi feita.
3. Começar pela primeira tarefa pendente da etapa atual.
4. Explicar o motivo das escolhas e manter as mudanças pequenas e revisáveis.
5. Ao concluir uma tarefa verificável, atualizar o checkbox correspondente e o registro de progresso com a data, evidência, aprendizado e próximo passo.
6. Se uma etapa não puder ser verificada no ambiente atual, registrar o bloqueio sem marcá-la como concluída.
