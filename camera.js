import { createKnnModel, predictLetter } from './classifier.js';

const video = document.querySelector('#camera-video');
const frame = document.querySelector('#video-frame');
const placeholder = document.querySelector('#camera-placeholder');
const overlay = document.querySelector('#hand-overlay');
const overlayContext = overlay.getContext('2d');
const startButton = document.querySelector('#start-camera');
const stopButton = document.querySelector('#stop-camera');
const detectButton = document.querySelector('#detect-hand');
const statusPill = document.querySelector('#camera-status');
const statusText = document.querySelector('#status-text');
const cameraMessage = document.querySelector('#camera-message');
const handMessage = document.querySelector('#hand-message');
const videoTag = document.querySelector('#video-tag');
const sessionInput = document.querySelector('#session-name');
const captureButtons = [...document.querySelectorAll('.capture-button')];
const sampleTotal = document.querySelector('#sample-total');
const datasetMessage = document.querySelector('#dataset-message');
const exportButton = document.querySelector('#export-dataset');
const clearDatasetButton = document.querySelector('#clear-dataset');
const predictionOutput = document.querySelector('#prediction-output');
const predictionAgreement = document.querySelector('#prediction-agreement');
const predictionDetail = document.querySelector('#prediction-detail');

const MEDIAPIPE_VERSION = '0.10.21';
const MEDIAPIPE_MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

let cameraStream = null;
let handLandmarker = null;
let animationFrame = null;
let lastVideoTime = -1;
let lastDetectionAt = 0;
let isTracking = false;
let latestLandmarks = null;
let latestHandedness = null;
let knnModel = null;
const collectedSamples = [];

async function loadKnnModel() {
  if (knnModel) return;
  const datasetUrl = new URL('./data/pilot/treino-sessao-1.json', import.meta.url);
  const response = await fetch(datasetUrl);
  if (!response.ok) throw new Error(`não encontrei o dataset (${response.status})`);
  const dataset = await response.json();
  const rejectionUrl = new URL('./data/pilot/rejeicoes.json', import.meta.url);
  const rejectionResponse = await fetch(rejectionUrl);
  if (rejectionResponse.ok) {
    const rejectionDataset = await rejectionResponse.json();
    dataset.samples.push(...(rejectionDataset.samples ?? []));
  }
  const rightHandRejectionUrl = new URL('./data/pilot/testedireita.json', import.meta.url);
  const rightHandRejectionResponse = await fetch(rightHandRejectionUrl);
  if (rightHandRejectionResponse.ok) {
    const rightHandRejectionDataset = await rightHandRejectionResponse.json();
    dataset.samples.push(...(rightHandRejectionDataset.samples ?? []));
  }
  knnModel = createKnnModel(dataset);
}

function updateDatasetControls() {
  const counts = { A: 0, B: 0, L: 0, Y: 0, OUTRA: 0 };
  const targets = { A: 30, B: 30, L: 30, Y: 30, OUTRA: 20 };
  for (const sample of collectedSamples) counts[sample.label] += 1;

  for (const label of Object.keys(counts)) {
    document.querySelector(`#count-${label}`).textContent = `${counts[label]} / ${targets[label]}`;
  }

  sampleTotal.textContent = `${collectedSamples.length} ${collectedSamples.length === 1 ? 'amostra' : 'amostras'}`;
  const canCapture = isTracking && latestLandmarks?.length === 21;
  captureButtons.forEach((button) => { button.disabled = !canCapture; });
  exportButton.disabled = collectedSamples.length === 0;
  clearDatasetButton.disabled = collectedSamples.length === 0;
}

function captureSample(label) {
  if (!isTracking || latestLandmarks?.length !== 21) {
    datasetMessage.textContent = 'Aguarde uma mão ser detectada antes de capturar.';
    return;
  }

  const session = sessionInput.value.trim();
  if (!session) {
    datasetMessage.textContent = 'Dê um nome curto para esta sessão antes de capturar.';
    sessionInput.focus();
    return;
  }

  collectedSamples.push({
    label,
    session,
    capturedAt: new Date().toISOString(),
    handedness: latestHandedness,
    landmarks: latestLandmarks.map(({ x, y, z }) => ({ x, y, z })),
  });

  updateDatasetControls();
  datasetMessage.textContent = `Amostra ${label} guardada nesta página. Faça outra pose e capture quando estiver pronto.`;
}

function exportDataset() {
  if (collectedSamples.length === 0) return;

  const exportObject = {
    formatVersion: 1,
    description: 'Landmarks do MediaPipe para estudo de A/B/L/Y e poses fora dessas classes. Não contém imagens.',
    classes: ['A', 'B', 'L', 'Y', 'OUTRA'],
    samples: collectedSamples,
  };
  const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `libras-landmarks-piloto-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
  datasetMessage.textContent = `JSON baixado com ${collectedSamples.length} amostras. Guarde o arquivo; atualizar a página apaga a coleta desta sessão.`;
}

function clearDataset() {
  if (!window.confirm('Apagar todas as amostras que ainda estão nesta página?')) return;
  collectedSamples.length = 0;
  updateDatasetControls();
  datasetMessage.textContent = 'Coleta apagada desta página.';
}

function setCameraStatus(state, label) {
  statusPill.dataset.state = state;
  statusText.textContent = label;
}

function clearHandOverlay() {
  overlayContext.clearRect(0, 0, overlay.width, overlay.height);
}

function stopHandTracking() {
  isTracking = false;
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  handLandmarker?.close();
  handLandmarker = null;
  latestLandmarks = null;
  latestHandedness = null;
  predictionOutput.textContent = '—';
  predictionOutput.dataset.other = 'false';
  predictionAgreement.textContent = '—';
  predictionDetail.textContent = knnModel
    ? 'Detecção parada. O conjunto local continua carregado.'
    : 'Detecção parada.';
  frame.classList.remove('is-tracking');
  clearHandOverlay();
  detectButton.textContent = 'Detectar mão';
  detectButton.disabled = !cameraStream;
  handMessage.textContent = cameraStream
    ? 'A detecção foi desligada. A câmera continua ativa.'
    : 'A detecção ainda não está ativa.';
  updateDatasetControls();
}

function stopCamera() {
  stopHandTracking();
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  video.srcObject = null;
  frame.classList.remove('is-live');
  placeholder.hidden = false;
  videoTag.hidden = true;
  startButton.disabled = false;
  stopButton.disabled = true;
  detectButton.disabled = true;
  setCameraStatus('idle', 'Desligada');
  cameraMessage.textContent = 'A câmera foi desligada. Nenhuma imagem foi gravada.';
  handMessage.textContent = 'A detecção ainda não está ativa.';
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setCameraStatus('error', 'Indisponível');
    cameraMessage.textContent = 'Este navegador não liberou acesso à câmera. Abra o projeto em localhost usando um navegador atualizado.';
    return;
  }

  startButton.disabled = true;
  cameraMessage.textContent = 'Aguardando sua autorização no navegador…';

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user' },
    });

    video.srcObject = cameraStream;
    await video.play();
    frame.classList.add('is-live');
    placeholder.hidden = true;
    videoTag.hidden = false;
    stopButton.disabled = false;
    detectButton.disabled = false;
    setCameraStatus('live', 'Câmera ativa');
    cameraMessage.textContent = 'Imagem ao vivo. O vídeo é processado nesta página; não gravamos nem enviamos frames.';
    handMessage.textContent = 'Clique em “Detectar mão” para carregar o modelo local de detecção.';
  } catch (error) {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    startButton.disabled = false;
    setCameraStatus('error', 'Não iniciou');

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      cameraMessage.textContent = 'Permissão negada. Libere o acesso à câmera no ícone ao lado do endereço do site e tente novamente.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      cameraMessage.textContent = 'Não encontrei uma webcam disponível. Verifique se ela está conectada e tente novamente.';
    } else {
      cameraMessage.textContent = `Não consegui iniciar a câmera (${error.name || 'erro'}). Confira a permissão e tente novamente.`;
    }
  }
}

function drawHand(landmarks) {
  if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }

  clearHandOverlay();
  overlayContext.lineWidth = Math.max(3, overlay.width * 0.004);
  overlayContext.lineCap = 'round';
  overlayContext.strokeStyle = '#a7f3c1';
  overlayContext.fillStyle = '#ffffff';

  for (const [start, end] of HAND_CONNECTIONS) {
    overlayContext.beginPath();
    overlayContext.moveTo(landmarks[start].x * overlay.width, landmarks[start].y * overlay.height);
    overlayContext.lineTo(landmarks[end].x * overlay.width, landmarks[end].y * overlay.height);
    overlayContext.stroke();
  }

  for (const point of landmarks) {
    overlayContext.beginPath();
    overlayContext.arc(point.x * overlay.width, point.y * overlay.height, Math.max(3, overlay.width * 0.006), 0, Math.PI * 2);
    overlayContext.fill();
  }
}

function trackVideoFrame() {
  if (!isTracking || !handLandmarker) return;

  const now = performance.now();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && video.currentTime !== lastVideoTime
      && now - lastDetectionAt >= 66) {
    const result = handLandmarker.detectForVideo(video, now);
    const landmarks = result.landmarks[0];
    lastVideoTime = video.currentTime;
    lastDetectionAt = now;

    if (landmarks) {
      latestLandmarks = landmarks;
      latestHandedness = result.handedness?.[0]?.[0]?.categoryName ?? 'unknown';
      drawHand(landmarks);
      handMessage.textContent = `Mão detectada: ${landmarks.length} pontos · MediaPipe: ${latestHandedness} (conferido neste notebook).`;
      if (knnModel && (latestHandedness === 'Left' || latestHandedness === 'Right')) {
        const prediction = predictLetter(knnModel, landmarks, latestHandedness);
        predictionOutput.dataset.other = prediction.label === 'OUTRA' ? 'true' : 'false';
        predictionOutput.textContent = prediction.label === 'OUTRA' ? 'OUTRA' : prediction.label ?? '?';
        const agreement = Math.round((prediction.votes / prediction.neighborCount) * 100);
        predictionAgreement.textContent = `${agreement}%`;
        predictionDetail.textContent = prediction.isUncertain
          ? `Incerto: ${prediction.votes}/${prediction.neighborCount} exemplos próximos votaram em ${prediction.topLabel}. A porcentagem é concordância, não chance calibrada.`
          : prediction.label === 'OUTRA'
            ? `${prediction.votes}/${prediction.neighborCount} exemplos próximos indicam uma pose fora de A/B/L/Y.`
            : `${prediction.votes}/${prediction.neighborCount} exemplos próximos concordam. A porcentagem não é uma chance calibrada de acerto.`;
      } else if (knnModel) {
        predictionOutput.textContent = '?';
      predictionOutput.dataset.other = 'false';
        predictionAgreement.textContent = '—';
        predictionDetail.textContent = 'Não consegui identificar a lateralidade desta mão.';
      }
    } else {
      latestLandmarks = null;
      latestHandedness = null;
      clearHandOverlay();
      handMessage.textContent = 'Nenhuma mão detectada. Tente deixar a mão inteira visível e mais iluminada.';
      predictionOutput.textContent = '—';
      predictionOutput.dataset.other = 'false';
      predictionAgreement.textContent = '—';
      predictionDetail.textContent = 'Sem mão detectada; nenhuma letra prevista.';
    }
    updateDatasetControls();
  }

  animationFrame = requestAnimationFrame(trackVideoFrame);
}

async function startHandTracking() {
  if (!cameraStream || isTracking) return;

  detectButton.disabled = true;
  handMessage.textContent = 'Carregando o detector MediaPipe… Na primeira vez, precisa de internet para baixar o código e o modelo.';

  try {
    const { FilesetResolver, HandLandmarker } = await import(MEDIAPIPE_MODULE);
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    try {
      await loadKnnModel();
      const otherCount = knnModel.samples.filter((sample) => sample.label === 'OUTRA').length;
      const rightHandOtherCount = knnModel.samples.filter(
        (sample) => sample.label === 'OUTRA' && sample.handedness === 'Right',
      ).length;
      predictionDetail.textContent = otherCount > 0
        ? `k-NN carregado com ${knnModel.samples.length} exemplos, incluindo ${otherCount} OUTRA (${rightHandOtherCount} da mão direita).`
        : `k-NN carregado com ${knnModel.samples.length} exemplos. Ainda sem exemplos OUTRA, então poses desconhecidas podem ser confundidas.`;
    } catch (error) {
      predictionDetail.textContent = `Detector pronto, mas não carreguei o classificador: ${error.message}.`;
    }

    isTracking = true;
    lastVideoTime = -1;
    lastDetectionAt = 0;
    frame.classList.add('is-tracking');
    detectButton.textContent = 'Parar detecção';
    handMessage.textContent = 'Detector pronto. Mostre uma mão inteira à câmera.';
    if (!knnModel) {
      predictionOutput.textContent = '—';
      predictionOutput.dataset.other = 'false';
      predictionAgreement.textContent = '—';
    }
    updateDatasetControls();
    animationFrame = requestAnimationFrame(trackVideoFrame);
  } catch (error) {
    handLandmarker?.close();
    handLandmarker = null;
    detectButton.textContent = 'Tentar novamente';
    handMessage.textContent = `Não consegui carregar o detector (${error.message || error.name}). Confira a internet e tente novamente.`;
  } finally {
    detectButton.disabled = false;
  }
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
detectButton.addEventListener('click', () => {
  if (isTracking) stopHandTracking();
  else startHandTracking();
});
captureButtons.forEach((button) => {
  button.addEventListener('click', () => captureSample(button.dataset.class));
});
exportButton.addEventListener('click', exportDataset);
clearDatasetButton.addEventListener('click', clearDataset);
sessionInput.addEventListener('input', () => {
  datasetMessage.textContent = 'Nome de sessão atualizado. Use outro nome na próxima coleta para separar sessões.';
});
updateDatasetControls();
window.addEventListener('pagehide', () => {
  stopHandTracking();
  cameraStream?.getTracks().forEach((track) => track.stop());
});
