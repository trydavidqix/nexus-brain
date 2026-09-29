import type { MaestriDecisionInput } from '@nexus-brain/contracts';
import { assertContract } from '@nexus-brain/contracts';
import type { LocalDecisionAdapter, LocalDecisionCandidate } from './local-decision-benchmark';
import type { MaestriDecisionCorpusCase } from './maestri-decision-corpus.v1';

type Label = string;
type FeatureName = 'risk' | 'denied' | 'approval_required' | 'ceo_required' | 'retry_allowed' | 'exact' | 'conflict' | 'unsupported' | 'has_route';
type Features = Record<FeatureName, string>;
interface Prediction { label: Label; probabilities: Map<Label, number>; }

const FEATURE_NAMES: FeatureName[] = ['risk', 'denied', 'approval_required', 'ceo_required', 'retry_allowed', 'exact', 'conflict', 'unsupported', 'has_route'];

function features(input: MaestriDecisionInput): Features {
  return {
    risk: input.risk,
    denied: String(input.policy.denied),
    approval_required: String(input.policy.approval_required),
    ceo_required: String(input.policy.ceo_required ?? false),
    retry_allowed: String(input.policy.retry_allowed ?? false),
    exact: String(input.signals.exact),
    conflict: String(input.signals.conflict ?? false),
    unsupported: String(input.signals.unsupported ?? false),
    has_route: String(Boolean(input.proposed_route)),
  };
}

function fit(examples: readonly MaestriDecisionCorpusCase[], labelOf: (example: MaestriDecisionCorpusCase) => Label) {
  const classes = new Map<Label, number>();
  const valueCounts = new Map<Label, Map<FeatureName, Map<string, number>>>();
  const domains = new Map<FeatureName, Set<string>>(FEATURE_NAMES.map(name => [name, new Set()]));
  for (const example of examples) {
    const label = labelOf(example);
    const vector = features(example.input);
    classes.set(label, (classes.get(label) || 0) + 1);
    if (!valueCounts.has(label)) valueCounts.set(label, new Map(FEATURE_NAMES.map(name => [name, new Map()])));
    for (const name of FEATURE_NAMES) {
      domains.get(name)?.add(vector[name]);
      const counts = valueCounts.get(label)?.get(name);
      counts?.set(vector[name], (counts.get(vector[name]) || 0) + 1);
    }
  }
  if (classes.size < 2) throw new Error('local_classifier_requires_multiple_labels');
  return {
    domains,
    predict(input: MaestriDecisionInput): Prediction | null {
      const vector = features(input);
      if (FEATURE_NAMES.some(name => !domains.get(name)?.has(vector[name]))) return null;
      const total = examples.length;
      const scores = [...classes].map(([label, count]) => {
        let score = Math.log(count / total);
        for (const name of FEATURE_NAMES) {
          const domainSize = domains.get(name)?.size || 1;
          const observed = valueCounts.get(label)?.get(name)?.get(vector[name]) || 0;
          score += Math.log((observed + 1) / (count + domainSize));
        }
        return [label, score] as const;
      });
      const max = Math.max(...scores.map(([, score]) => score));
      const denominators = scores.map(([, score]) => Math.exp(score - max));
      const sum = denominators.reduce((acc, value) => acc + value, 0);
      const probabilities = new Map(scores.map(([label], index) => [label, denominators[index] / sum]));
      const label = [...probabilities].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0][0];
      return { label, probabilities };
    },
  };
}

function outputLabel(example: MaestriDecisionCorpusCase): string {
  if (example.expected.route === 'blocked') return 'blocked';
  if (example.expected.route === 'approval') return 'approval';
  if (example.expected.route === 'fallback') return 'fallback';
  return 'route';
}

function temperatureScale(probabilities: Map<Label, number>, temperature: number): Map<Label, number> {
  const logits = [...probabilities].map(([label, probability]) => [label, Math.log(Math.max(probability, 1e-12)) / temperature] as const);
  const maximum = Math.max(...logits.map(([, score]) => score));
  const exponentials = logits.map(([, score]) => Math.exp(score - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return new Map(logits.map(([label], index) => [label, exponentials[index] / total]));
}

function fitTemperature(model: ReturnType<typeof fit>, examples: readonly MaestriDecisionCorpusCase[], labelOf: (example: MaestriDecisionCorpusCase) => Label): number {
  let bestTemperature = 1;
  let bestLoss = Number.POSITIVE_INFINITY;
  for (let step = 5; step <= 40; step += 1) {
    const temperature = step / 10;
    let loss = 0;
    let count = 0;
    for (const example of examples) {
      const prediction = model.predict(example.input);
      if (!prediction) continue;
      const calibrated = temperatureScale(prediction.probabilities, temperature);
      loss -= Math.log(Math.max(calibrated.get(labelOf(example)) || 0, 1e-12));
      count += 1;
    }
    if (count && loss / count < bestLoss) { bestLoss = loss / count; bestTemperature = temperature; }
  }
  return bestTemperature;
}

function argmax(probabilities: Map<Label, number>): [string, number] {
  return [...probabilities].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
}

function adaptRoute(disposition: string, input: MaestriDecisionInput): string {
  if (disposition === 'route') return input.proposed_route || 'fallback';
  if (disposition === 'blocked' || disposition === 'approval' || disposition === 'fallback') return disposition;
  return 'fallback';
}

export interface LocalMaestriClassifier extends LocalDecisionAdapter {
  training_count: number;
  calibration_count: number;
  calibration_fit_count: number;
  threshold_version: string;
  predict(input: MaestriDecisionInput): LocalDecisionCandidate & { abstain: boolean; needs_review: boolean; needs_approval: boolean; needs_ceo: boolean };
}

export function trainLocalMaestriClassifier(
  training: readonly MaestriDecisionCorpusCase[],
  calibration: readonly MaestriDecisionCorpusCase[],
): LocalMaestriClassifier {
  if (training.some(example => example.split !== 'train') || calibration.some(example => example.split !== 'calibration')) throw new Error('local_classifier_split_mismatch');
  if (!training.length || !calibration.length) throw new Error('local_classifier_data_required');

  const dispositionModel = fit(training, outputLabel);
  const reviewModel = fit(training, example => String(example.expected.needs_review));
  const approvalModel = fit(training, example => String(example.expected.needs_approval));
  const ceoModel = fit(training, example => String(example.expected.needs_ceo));
  const temperature = fitTemperature(dispositionModel, calibration, outputLabel);
  const calibrationFitCount = calibration.filter(example => dispositionModel.predict(example.input) !== null).length;
  const routeDomain = new Set(training.map(example => example.input.proposed_route).filter((value): value is string => Boolean(value)));

  const calibrationConfidence: number[] = [];
  const misclassifiedConfidence: number[] = [];
  for (const example of calibration) {
    const prediction = dispositionModel.predict(example.input);
    if (!prediction) continue;
    const calibrated = temperatureScale(prediction.probabilities, temperature);
    const [label, confidence] = argmax(calibrated);
    calibrationConfidence.push(confidence);
    if (label !== outputLabel(example)) misclassifiedConfidence.push(confidence);
  }
  const abstainThreshold = misclassifiedConfidence.length
    ? Math.min(1, Math.max(...misclassifiedConfidence) + 1e-6)
    : Math.min(...calibrationConfidence);

  return {
    adapter_id: 'nexus-native-categorical-naive-bayes',
    version: '1.0.0',
    execution_mode: 'local',
    training_count: training.length,
    calibration_count: calibration.length,
    calibration_fit_count: calibrationFitCount,
    threshold_version: 'maestri-decision-contract-v1-calibration-v1',
    predict(input) {
      assertContract('maestri-decision-input', input);
      const fallback = (confidence: number) => ({
        route: 'fallback', calibrated_confidence: confidence, abstain: true,
        needs_review: input.risk === 'R2' || input.risk === 'R3' || input.risk === 'R4',
        needs_approval: input.policy.approval_required || input.risk === 'R4',
        needs_ceo: input.policy.ceo_required ?? input.risk === 'R4',
      });
      if (!input.proposed_route || input.signals.conflict || input.signals.unsupported || !input.signals.exact) return fallback(0);
      if (!routeDomain.has(input.proposed_route)) return fallback(0);

      const disposition = dispositionModel.predict(input);
      const review = reviewModel.predict(input);
      const approvalResult = approvalModel.predict(input);
      const ceo = ceoModel.predict(input);
      if (!disposition || !review || !approvalResult || !ceo) return fallback(0);
      const calibrated = temperatureScale(disposition.probabilities, temperature);
      const [label, confidence] = argmax(calibrated);
      if (confidence < abstainThreshold) return fallback(confidence);
      return {
        route: adaptRoute(label, input), calibrated_confidence: confidence, abstain: false,
        needs_review: review.label === 'true',
        needs_approval: approvalResult.label === 'true',
        needs_ceo: ceo.label === 'true',
      };
    },
  };
}

