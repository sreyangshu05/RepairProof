import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../prisma/prisma.service';
import { SignUpDto, LoginDto } from './auth.dto';
import { UserRole } from '@repairproof/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project')) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async signUp(dto: SignUpDto) {
    let userId = 'dev-tech-1';
    let token = 'dev-technician-token';

    if (this.supabase) {
      const { data, error } = await this.supabase.auth.signUp({
        email: dto.email,
        password: dto.password,
        options: {
          data: {
            displayName: dto.displayName,
            role: dto.role || UserRole.TECHNICIAN,
          },
        },
      });

      if (error || !data.user) {
        throw new BadRequestException(error?.message || 'Failed to sign up');
      }

      userId = data.user.id;
      token = data.session?.access_token || 'dev-token';
    }

    // Create or find default shop if needed
    let shopId: string | null = null;
    const existingShop = await this.prisma.shop.findFirst({
      where: { ownerId: userId },
    });

    if (existingShop) {
      shopId = existingShop.id;
    } else {
      const shop = await this.prisma.shop.create({
        data: {
          name: dto.shopName || `${dto.displayName}'s Repair Hub`,
          ownerId: userId,
          email: dto.email,
        },
      });
      shopId = shop.id;
    }

    // Create or update Profile in database
    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        displayName: dto.displayName,
        role: dto.role || UserRole.TECHNICIAN,
        phone: dto.phone,
        shopId,
      },
      create: {
        userId,
        email: dto.email,
        displayName: dto.displayName,
        role: dto.role || UserRole.TECHNICIAN,
        phone: dto.phone,
        shopId,
      },
      include: {
        shop: true,
      },
    });

    return {
      user: {
        id: userId,
        email: dto.email,
        displayName: profile.displayName,
        role: profile.role,
        shop: profile.shop,
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    if (!this.supabase) {
      // Dev mock login
      const profile = await this.prisma.profile.findFirst({
        where: { email: dto.email },
        include: { shop: true },
      });

      return {
        user: {
          id: profile?.userId || 'dev-tech-1',
          email: dto.email,
          displayName: profile?.displayName || 'Lead Technician',
          role: profile?.role || UserRole.TECHNICIAN,
          shop: profile?.shop,
        },
        token: 'dev-technician-token',
      };
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException(error?.message || 'Invalid credentials');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { userId: data.user.id },
      include: { shop: true },
    });

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: profile?.displayName || data.user.user_metadata?.displayName || 'Technician',
        role: profile?.role || UserRole.TECHNICIAN,
        shop: profile?.shop,
      },
      token: data.session.access_token,
    };
  }

  async getMe(userId: string) {
    let profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { shop: true },
    });

    if (!profile) {
      // Auto-create initial profile if first login
      const shop = await this.prisma.shop.create({
        data: {
          name: 'RepairProof Workshop',
          ownerId: userId,
        },
      });

      profile = await this.prisma.profile.create({
        data: {
          userId,
          email: 'tech@repairproof.dev',
          displayName: 'Certified Technician',
          role: UserRole.TECHNICIAN,
          shopId: shop.id,
        },
        include: { shop: true },
      });
    }

    return profile;
  }
}
