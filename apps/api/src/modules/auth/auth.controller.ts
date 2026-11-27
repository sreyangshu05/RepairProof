import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto, RequestEmailOtpDto, VerifyEmailOtpDto } from './auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('signup/resend')
  resendSignupConfirmation(@Body() dto: RequestEmailOtpDto) {
    void dto;
    return this.authService.resendSignupConfirmation();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestEmailOtpDto) {
    void dto;
    return this.authService.requestEmailOtp();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyEmailOtpDto) {
    void dto;
    return this.authService.verifyEmailOtp();
  }

  @Get('me')
  async getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }
}
