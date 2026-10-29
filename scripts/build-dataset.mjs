import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pilotDirectory = resolve(projectRoot, 'data', 'pilot');
const sourceDirectory = resolve(pilotDirectory, 'fontes', 'sessoes');
const outputPath = resolve(pilotDirectory, 'treino.json');
const allowedClasses = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'L', 'M', 'O', 'Y', 'OUTRA']);
const sourceFiles = [
  'treino-sessao-1.json',
  'rejeicoes.json',
  'testedireita.json',
  'rejeicoes-sessao-4.json',
  'rejeicoes-sessao-5.json',
  'validos-sessao-6.json',
  'rejeicoes-sessao-7.json',
  'validos-sessao-8-cdef.json',
  'validos-sessao-9-a-e.json',
  'validos-sessao-10-a-esquerda.json',
];

const samples = [];
const seenSamples = new Set();

for (const fileName of sourceFiles) {
  const sourcePath = resolve(sourceDirectory, fileName);
  const dataset = JSON.parse(await readFile(sourcePath, 'utf8'));

  if (!Array.isArray(dataset.samples)) {
    throw new Error(`${fileName}: campo samples ausente ou inválido.`);
  }

  for (const [index, sample] of dataset.samples.entries()) {
    const sampleNumber = index + 1;
    if (!allowedClasses.has(sample.label)) {
      throw new Error(`${fileName}, amostra ${sampleNumber}: classe inválida (${sample.label}).`);
    }
    if (!Array.isArray(sample.landmarks) || sample.landmarks.length !== 21) {
      throw new Error(`${fileName}, amostra ${sampleNumber}: esperados 21 landmarks.`);
    }
    if (sample.handedness !== 'Left' && sample.handedness !== 'Right') {
      throw new Error(`${fileName}, amostra ${sampleNumber}: lateralidade inválida.`);
    }
    for (const point of sample.landmarks) {
      if (!['x', 'y', 'z'].every((axis) => Number.isFinite(point[axis]))) {
        throw new Error(`${fileName}, amostra ${sampleNumber}: coordenada inválida.`);
      }
    }

    const sampleKey = `${sample.capturedAt}|${sample.session}|${sample.label}`;
    if (seenSamples.has(sampleKey)) {
      throw new Error(`${fileName}, amostra ${sampleNumber}: amostra repetida (${sampleKey}).`);
    }
    seenSamples.add(sampleKey);
    samples.push(sample);
  }
}

const compiledDataset = {
  formatVersion: 1,
  description: 'Conjunto de treino consolidado para o protótipo local de Libras. Inclui A, B, C, D, E, F, G, I, L, M, O, Y e OUTRA; sessões e metadados originais são mantidos por amostra.',
  classes: [...allowedClasses],
  sources: sourceFiles,
  samples,
};

await writeFile(outputPath, `${JSON.stringify(compiledDataset, null, 2)}\n`, 'utf8');
const counts = Object.fromEntries([...allowedClasses].map((label) => [
  label,
  samples.filter((sample) => sample.label === label).length,
]));
process.stdout.write(`Gerado data/pilot/treino.json com ${samples.length} amostras: ${JSON.stringify(counts)}\n`);
