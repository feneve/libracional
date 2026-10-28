const VALID_CLASSES = new Set(['A', 'B', 'L', 'Y', 'OUTRA']);
const K_NEIGHBORS = 5;

/**
 * Move the wrist to the origin, scale by palm length, and reflect one hand
 * so left/right samples use the same horizontal orientation.
 */
export function normalizeLandmarks(landmarks, handedness) {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) {
    throw new Error('Uma amostra precisa conter exatamente 21 landmarks.');
  }
  if (handedness !== 'Left' && handedness !== 'Right') {
    throw new Error('A lateralidade precisa ser Left ou Right.');
  }

  const wrist = landmarks[0];
  const middleFingerBase = landmarks[9];
  const palmScale = Math.hypot(
    middleFingerBase.x - wrist.x,
    middleFingerBase.y - wrist.y,
    middleFingerBase.z - wrist.z,
  );

  if (!Number.isFinite(palmScale) || palmScale < 1e-6) {
    throw new Error('Não foi possível calcular a escala da mão.');
  }

  const horizontalSign = handedness === 'Right' ? -1 : 1;
  return landmarks.flatMap((point) => [
    ((point.x - wrist.x) * horizontalSign) / palmScale,
    (point.y - wrist.y) / palmScale,
    (point.z - wrist.z) / palmScale,
  ]);
}

export function createKnnModel(dataset) {
  if (!Array.isArray(dataset?.samples) || dataset.samples.length === 0) {
    throw new Error('O JSON não contém amostras para o classificador.');
  }

  const samples = dataset.samples
    .filter((sample) => VALID_CLASSES.has(sample.label))
    .map((sample) => ({
      label: sample.label,
      features: normalizeLandmarks(sample.landmarks, sample.handedness),
    }));

  if (samples.length === 0) {
    throw new Error('Não encontrei amostras válidas das classes A, B, L e Y.');
  }

  return { samples, k: K_NEIGHBORS };
}

export function predictLetter(model, landmarks, handedness) {
  const features = normalizeLandmarks(landmarks, handedness);
  const nearest = model.samples
    .map((sample) => {
      let squaredDistance = 0;
      for (let index = 0; index < features.length; index += 1) {
        const difference = features[index] - sample.features[index];
        squaredDistance += difference * difference;
      }
      return { label: sample.label, distance: Math.sqrt(squaredDistance) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(model.k, model.samples.length));

  const votes = new Map();
  for (const neighbor of nearest) {
    const current = votes.get(neighbor.label) ?? { count: 0, distance: 0 };
    current.count += 1;
    current.distance += neighbor.distance;
    votes.set(neighbor.label, current);
  }

  const ranking = [...votes.entries()].sort((a, b) =>
    b[1].count - a[1].count || a[1].distance - b[1].distance,
  );
  const [label, result] = ranking[0];
  const requiredVotes = Math.floor(nearest.length / 2) + 1;

  return {
    label: result.count >= requiredVotes ? label : null,
    topLabel: label,
    votes: result.count,
    neighborCount: nearest.length,
    isUncertain: result.count < requiredVotes,
  };
}
