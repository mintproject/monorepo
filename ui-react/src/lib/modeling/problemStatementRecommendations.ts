import { getSemanticSearchApiUrl } from '@/lib/config';

export interface ProblemStatementRecommendationRequest {
  title?: string;
  name?: string;
  description?: string;
  goals?: string[];
  region_id?: string | null;
  region_name?: string | null;
  selected_variable_ids?: string[];
  selected_model_configuration_ids?: string[];
  start_date?: string | null;
  end_date?: string | null;
  limit?: number;
}

export interface RecommendationEvidence {
  source?: string;
  id?: string;
  label?: string;
  relation?: string;
}

export interface StandardVariableRecommendation {
  id: string;
  label?: string | null;
  description?: string | null;
  score?: number;
  evidence?: RecommendationEvidence[];
  models?: Array<{ id: string; label?: string | null; role?: string }>;
}

export interface ModelConfigurationRecommendation {
  id: string;
  label?: string | null;
  description?: string | null;
  score?: number;
  standard_variables?: Array<{ id: string; label?: string | null; role?: string }>;
  regions?: Array<{ id: string; label?: string | null }>;
  evidence?: RecommendationEvidence[];
}

export interface ProblemStatementRecommendationResponse {
  capability?: string;
  status: 'ok' | 'empty' | 'abstained';
  reason?: string;
  context?: { text?: string; sources?: string[] };
  results: {
    svo: StandardVariableRecommendation[];
    model_configuration: ModelConfigurationRecommendation[];
  };
}

export async function recommendProblemStatement(
  request: ProblemStatementRecommendationRequest,
  options: { signal?: AbortSignal } = {},
): Promise<ProblemStatementRecommendationResponse> {
  const response = await fetch(`${getSemanticSearchApiUrl()}/problem-statements/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Recommendations failed (${response.status})`);

  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') {
    throw new Error('Recommendations returned an invalid response');
  }
  const value = body as Partial<ProblemStatementRecommendationResponse>;
  if (!value.status || !value.results || typeof value.results !== 'object') {
    throw new Error('Recommendations returned an invalid response');
  }
  return {
    status: value.status,
    capability: value.capability,
    reason: value.reason,
    context: value.context,
    results: {
      svo: Array.isArray(value.results.svo) ? value.results.svo : [],
      model_configuration: Array.isArray(value.results.model_configuration)
        ? value.results.model_configuration
        : [],
    },
  };
}
