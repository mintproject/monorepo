import { describe, expect, it } from 'vitest';
import {
  inferOutcomeDriverOptions,
  type VariableTransform,
} from '@/lib/modeling/outcome-driver-inference';

const variable = (id: string, label = id) => ({ id, label, description: null });

describe('inferOutcomeDriverOptions', () => {
  it('follows mixed model and ETL transforms across multiple steps', () => {
    const transforms: VariableTransform[] = [
      { outputs: [variable('outcome')], inputs: [variable('intermediate')] },
      { outputs: [variable('intermediate')], inputs: [variable('rain')] },
      { outputs: [variable('rain')], inputs: [variable('forcing')] },
    ];

    expect(inferOutcomeDriverOptions('outcome', transforms).map((item) => item.id)).toEqual([
      'forcing',
      'intermediate',
      'rain',
    ]);
  });

  it('deduplicates branches, handles cycles, and excludes the outcome', () => {
    const transforms: VariableTransform[] = [
      { outputs: [variable('outcome')], inputs: [variable('rain'), variable('soil')] },
      { outputs: [variable('rain')], inputs: [variable('soil')] },
      { outputs: [variable('soil')], inputs: [variable('outcome'), variable('bedrock')] },
      { outputs: [variable('outcome')], inputs: [variable('rain')] },
    ];

    expect(inferOutcomeDriverOptions('outcome', transforms).map((item) => item.id)).toEqual([
      'bedrock',
      'rain',
      'soil',
    ]);
  });

  it('uses an id fallback for a variable only named by a transform contract', () => {
    const result = inferOutcomeDriverOptions('outcome', [
      { outputs: [variable('outcome')], inputs: [{ id: 'https://example.org/rain' }] },
    ]);

    expect(result).toEqual([
      { id: 'https://example.org/rain', label: 'https://example.org/rain', description: null },
    ]);
  });
});
