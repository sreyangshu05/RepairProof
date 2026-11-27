import { Injectable, BadRequestException, UnauthorizedException, ServiceUnavailableException, ForbiddenException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SignUpDto, LoginDto } from './auth.dto';
import { UserRole } from '@repairproof/shared';
import { AnalyticsService, PRODUCT_ANALYTICS_NOTICE_VERSION } from '../analytics/analytics.service';

const scrypt = promisify(scryptCallback);
const TOKEN_TTL = 8 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, @Optional() private readonly analytics?: AnalyticsService) {}

  async signUp(dto: SignUpDto) {
    const email = dto.email.trim().toLowerCase();
    const salt = randomBytes(16);
    const hash = (await scrypt(dto.password, salt, 64)) as Buffer;
    const passwordHash = `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
    const userId = randomUUID();
    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({ data: { name: dto.shopName?.trim() || `${dto.displayName.trim()}'s Repair Hub`, ownerId: userId, email } });
        const created = await tx.profile.create({ data: { userId, email, displayName: dto.displayName.trim(), role: UserRole.SHOP_OWNER, phone: dto.phone, shopId: shop.id }, include: { shop: true } });
        await tx.authCredential.create({ data: { userId, email, passwordHash } });
        await tx.organizationMembership.create({ data: { shopId: shop.id, profileId: created.id, role: UserRole.SHOP_OWNER } });
        await tx.auditEvent.create({ data: { shopId: shop.id, actorId: created.id, action: 'organization.created', entityType: 'Shop', entityId: shop.id, metadata: { authProvider: 'repairproof' } } });
        if (dto.analyticsConsent) await tx.analyticsConsent.create({ data: { profileId: created.id, decision: 'GRANTED', noticeVersion: PRODUCT_ANALYTICS_NOTICE_VERSION } });
        return created;
      });
      if (dto.analyticsConsent) void this.analytics?.record({ name: 'account.registration_completed', sourceId: profile.id, actorProfileId: profile.id, shopId: profile.shopId!, role: profile.role, properties: { channel: 'web_signup' } });
      return { user: { id: userId, email, displayName: profile.displayName, locale: profile.locale, role: profile.role, shop: profile.shop }, token: this.issueToken(userId, email) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new BadRequestException('An account with this email already exists');
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const credential = await this.prisma.authCredential.findUnique({ where: { email } });
    const [scheme, saltText, hashText] = credential?.passwordHash.split('$') ?? [];
    let valid = false;
    if (credential && scheme === 'scrypt' && saltText && hashText) {
      const expected = Buffer.from(hashText, 'base64url');
      const actual = (await scrypt(dto.password, Buffer.from(saltText, 'base64url'), expected.length)) as Buffer;
      valid = actual.length === expected.length && timingSafeEqual(actual, expected);
    }
    if (!credential || !valid) throw new UnauthorizedException('Email or password is incorrect');
    return this.loginResult(credential.userId, email);
  }

  verifyAccessToken(token: string): { id: string; email: string } {
    const [head, body, signature, extra] = token.split('.');
    if (!head || !body || !signature || extra) throw new UnauthorizedException('Invalid or expired token');
    const content = `${head}.${body}`;
    const expected = Buffer.from(this.sign(content));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException('Invalid or expired token');
    let claims: { sub?: string; email?: string; exp?: number };
    try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new UnauthorizedException('Invalid or expired token'); }
    if (!claims.sub || !claims.email || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) throw new UnauthorizedException('Invalid or expired token');
    return { id: claims.sub, email: claims.email };
  }

  async getMe(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, include: { shop: true, platformAdminRecord: { select: { active: true } } } });
    if (!profile || profile.deletedAt || !profile.isActive) throw new ForbiddenException('Account is not provisioned for RepairProof');
    return { ...profile, role: profile.platformAdminRecord?.active ? UserRole.PLATFORM_ADMIN : profile.role };
  }

  async resendSignupConfirmation() { throw new BadRequestException('Email confirmation is not enabled; sign in with your password.'); }
  async requestEmailOtp() { throw new BadRequestException('Email OTP is not enabled in this authentication mode.'); }
  async verifyEmailOtp() { throw new BadRequestException('Email OTP is not enabled in this authentication mode.'); }

  private async loginResult(userId: string, email: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId }, include: { shop: true, platformAdminRecord: { select: { active: true } } } });
    if (!profile || profile.deletedAt || !profile.isActive) throw new ForbiddenException('Account is not active in RepairProof');
    const admin = await this.prisma.platformAdmin.findFirst({ where: { profileId: profile.id, active: true }, select: { id: true } });
    let role: string = admin ? UserRole.PLATFORM_ADMIN : profile.role;
    if (!admin && profile.role === UserRole.PLATFORM_ADMIN) throw new ForbiddenException('Platform administrator grant is inactive');
    if (!admin && profile.shopId) {
      const membership = await this.prisma.organizationMembership.findFirst({ where: { shopId: profile.shopId, profileId: profile.id, revokedAt: null, shop: { deletedAt: null } }, select: { role: true } });
      if (!membership) throw new ForbiddenException('Active organization membership is required');
      role = membership.role;
    }
    if (!admin && !profile.shopId) throw new ForbiddenException('Active organization membership is required');
    return { user: { id: userId, email, displayName: profile.displayName, locale: profile.locale, role, shop: admin ? null : profile.shop }, token: this.issueToken(userId, email) };
  }

  private issueToken(sub: string, email: string) {
    const now = Math.floor(Date.now() / 1000);
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub, email, iat: now, exp: now + TOKEN_TTL })).toString('base64url');
    const content = `${head}.${body}`;
    return `${content}.${this.sign(content)}`;
  }

  private sign(content: string) {
    const secret = this.config.get<string>('AUTH_JWT_SECRET');
    if (!secret || Buffer.byteLength(secret) < 32) throw new ServiceUnavailableException('Configure AUTH_JWT_SECRET with at least 32 random bytes');
    return createHmac('sha256', secret).update(content).digest('base64url');
  }
}
