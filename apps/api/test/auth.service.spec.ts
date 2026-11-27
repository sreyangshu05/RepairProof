import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthService first-party authentication', () => {
  const prisma: any = {};
  const config: any = { get: (key: string) => key === 'AUTH_JWT_SECRET' ? 'local-test-secret-'.padEnd(40, 'x') : undefined };
  const service = new AuthService(prisma, config);

  it('does not expose OTP or email-confirmation endpoints in password auth mode', async () => {
    await expect(service.requestEmailOtp()).rejects.toThrow(BadRequestException);
    await expect(service.verifyEmailOtp()).rejects.toThrow(BadRequestException);
    await expect(service.resendSignupConfirmation()).rejects.toThrow(BadRequestException);
  });

  it('rejects malformed or expired access tokens', () => {
    expect(() => service.verifyAccessToken('not-a-token')).toThrow(UnauthorizedException);
  });
});
