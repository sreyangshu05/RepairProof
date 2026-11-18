import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Check for dev bypass token in development mode
    if (process.env.NODE_ENV !== 'production' && (token === 'dev-technician-token' || token === 'mock-token')) {
      request.user = {
        userId: 'dev-tech-1',
        email: 'tech@repairproof.dev',
        role: 'TECHNICIAN',
      };
      return true;
    }

    if (!this.supabase) {
      // In local dev without live Supabase credentials configured yet
      this.logger.warn('Supabase client not initialized. Using developer token mock.');
      request.user = {
        userId: 'dev-tech-1',
        email: 'tech@repairproof.dev',
        role: 'TECHNICIAN',
      };
      return true;
    }

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException(error?.message || 'Invalid or expired token');
      }

      // Fetch or sync the profile from database
      const profile = await this.prisma.profile.findUnique({
        where: { userId: user.id },
      });

      request.user = {
        userId: user.id,
        email: user.email,
        role: profile?.role || 'TECHNICIAN',
        profile,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Failed to authenticate request');
    }
  }
}
