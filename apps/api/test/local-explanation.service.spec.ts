import { LocalExplanationService } from '../src/modules/diagnostic-consistency/local-explanation.service';

const assessment: any = {
  signal: 'INSUFFICIENT_RECORDED_EVIDENCE',
  supportingEvidence: [
    {
      type: 'CUSTOMER_SYMPTOM',
      id: 'symptom-1',
      label: 'Customer symptom',
      detail: 'Private customer details',
    },
    {
      type: 'DEVICE_RULE',
      id: 'rule-1',
      label: 'Manufacturer guidance',
      sourceUrl: 'https://example.test/rule',
    },
  ],
  missingEvidence: [{ type: 'MEASUREMENT', label: 'No structured measurement' }],
  potentialInconsistencies: [],
  confidenceLimitations: ['Not a diagnosis.'],
  recommendedHumanReview: ['Review test results.'],
  applicableRule: {
    id: 'rule-1',
    title: 'Manufacturer guidance',
    url: 'https://example.test/rule',
  },
};

describe('LocalExplanationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('stays disabled unless an explicit model and enable flag are configured', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const service = new LocalExplanationService({
      get: (key: string) =>
        (({ DIAGNOSTIC_LLM_ENABLED: 'false', DIAGNOSTIC_LLM_MODEL: 'qwen2.5:1.5b' }) as any)[key],
    } as any);
    expect(await service.explain(assessment)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts only local Ollama output with citations drawn from the assessment', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            summary:
              'The available record is incomplete; a technician should review the cited guidance.',
            citations: ['rule-1'],
          }),
        },
      }),
    } as Response);
    const service = new LocalExplanationService({
      get: (key: string) =>
        (
          ({
            DIAGNOSTIC_LLM_ENABLED: 'true',
            DIAGNOSTIC_LLM_MODEL: 'qwen2.5:1.5b',
            DIAGNOSTIC_LLM_BASE_URL: 'http://127.0.0.1:11434',
          }) as any
        )[key],
    } as any);
    const result = await service.explain(assessment);
    expect(result?.provider).toBe('OLLAMA_LOCAL');
    expect(result?.citations).toEqual([
      { id: 'rule-1', label: 'Manufacturer guidance', url: 'https://example.test/rule' },
    ]);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(requestBody.messages[1].content).not.toContain('Private customer details');
  });

  it('drops malformed or unsupported citations and rejects non-local inference endpoints', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            summary: 'An explanation with an invented assertion.',
            citations: ['not-a-record'],
          }),
        },
      }),
    } as Response);
    const config = {
      get: (key: string) =>
        (
          ({
            DIAGNOSTIC_LLM_ENABLED: 'true',
            DIAGNOSTIC_LLM_MODEL: 'qwen2.5:1.5b',
            DIAGNOSTIC_LLM_BASE_URL: 'https://hosted.example.test',
          }) as any
        )[key],
    };
    const service = new LocalExplanationService(config as any);
    expect(await service.explain(assessment)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    const localService = new LocalExplanationService({
      get: (key: string) =>
        (
          ({
            DIAGNOSTIC_LLM_ENABLED: 'true',
            DIAGNOSTIC_LLM_MODEL: 'qwen2.5:1.5b',
            DIAGNOSTIC_LLM_BASE_URL: 'http://localhost:11434',
          }) as any
        )[key],
    } as any);
    expect(await localService.explain(assessment)).toBeNull();
  });
});
