import { ServiceUnavailableException } from '@nestjs/common';
import { AuthorizationController } from '../src/modules/authorization/authorization.controller';

describe('AuthorizationController launch gate', () => {
  it('fails closed when the public authorization feature flag is absent or false', async () => {
    const service: any = { getCaseByToken: jest.fn() };
    const config: any = { get: jest.fn().mockReturnValue('false') };
    const controller = new AuthorizationController(service, config);
    await expect(controller.getCase('token')).rejects.toThrow(ServiceUnavailableException);
    expect(service.getCaseByToken).not.toHaveBeenCalled();
  });

  it('allows the endpoint only after explicit opt-in', async () => {
    const service: any = { getCaseByToken: jest.fn().mockResolvedValue({ caseNumber: 'RP-1' }) };
    const config: any = { get: jest.fn().mockReturnValue('true') };
    const controller = new AuthorizationController(service, config);
    await expect(controller.getCase('token')).resolves.toEqual({ caseNumber: 'RP-1' });
    expect(service.getCaseByToken).toHaveBeenCalledWith('token');
  });
});
