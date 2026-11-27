import * as Sentry from '@sentry/nestjs';
import { SentryErrorMonitor } from '../src/common/integrations/error-monitor';
import { sanitizeSentryEvent } from '../src/instrument';

describe('Sentry error-monitor adapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('captures only server errors with safe correlation tags', () => {
    const setTag = jest.fn();
    jest
      .spyOn(Sentry, 'withScope')
      .mockImplementation(((callback: (scope: any) => void) => callback({ setTag })) as any);
    const capture = jest.spyOn(Sentry, 'captureException').mockReturnValue('event-id');
    const error = new Error('database failure');
    new SentryErrorMonitor().capture(error, {
      requestId: 'req-1',
      route: '/cases/:caseId',
      method: 'POST',
      status: 500,
    });
    expect(setTag).toHaveBeenCalledWith('request_id', 'req-1');
    expect(setTag).toHaveBeenCalledWith('route', '/cases/:caseId');
    expect(capture).toHaveBeenCalledWith(error);
  });

  it('removes request identity and payload from events before transmission', () => {
    const event: any = {
      user: { email: 'customer@example.test' },
      request: {
        url: 'https://repairproof.test/private?token=secret',
        data: { serialNumber: '123' },
      },
      breadcrumbs: [{ message: 'private customer action' }],
      extra: { customerEmail: 'customer@example.test' },
      exception: { values: [{ type: 'Error', value: 'failure includes a customer address' }] },
    };
    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.request).toBeUndefined();
    expect(sanitized.breadcrumbs).toBeUndefined();
    expect(sanitized.extra).toBeUndefined();
    expect(sanitized.exception?.values?.[0]?.value).toBe('Unhandled server exception');
  });
});
