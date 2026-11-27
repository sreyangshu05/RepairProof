import { PrismaClient, UserRole } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

for (const envFile of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

async function main() {
  const userId = process.env.PLATFORM_ADMIN_USER_ID?.trim();
  const action = process.env.PLATFORM_ADMIN_ACTION?.trim().toLowerCase();
  const reason = process.env.PLATFORM_ADMIN_REASON?.trim();
  if (!userId || !reason || !['grant', 'revoke'].includes(action ?? '')) {
    throw new Error(
      'Set PLATFORM_ADMIN_USER_ID, PLATFORM_ADMIN_ACTION=grant|revoke, and PLATFORM_ADMIN_REASON',
    );
  }
  const prisma = new PrismaClient();
  try {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile || profile.deletedAt || !profile.isActive)
      throw new Error('The Supabase user must have an active RepairProof profile first');
    const existingGrant = await prisma.platformAdmin.findUnique({
      where: { profileId: profile.id },
    });
    if (action === 'grant') {
      await prisma.$transaction(async (tx) => {
        await tx.platformAdmin.upsert({
          where: { profileId: profile.id },
          create: {
            profileId: profile.id,
            previousRole:
              profile.role === UserRole.PLATFORM_ADMIN ? UserRole.TECHNICIAN : profile.role,
            reason,
          },
          update: { active: true, revokedAt: null, reason },
        });
        await tx.profile.update({
          where: { id: profile.id },
          data: { role: UserRole.PLATFORM_ADMIN },
        });
        await tx.platformAdminAuditEvent.create({
          data: {
            actorProfileId: profile.id,
            action: 'platform_admin.granted',
            targetType: 'Profile',
            targetId: profile.id,
            metadata: { reason },
          },
        });
      });
      process.stdout.write(`Granted platform administrator access to profile ${profile.id}\n`);
      return;
    }
    if (!existingGrant?.active)
      throw new Error('No active platform administrator grant exists for this user');
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('repairproof-platform-admin-grants'))::text AS acquired`;
      const activeAdminCount = await tx.platformAdmin.count({ where: { active: true } });
      if (activeAdminCount <= 1)
        throw new Error('Cannot revoke the final active platform administrator');
      await tx.platformAdmin.update({
        where: { profileId: profile.id },
        data: { active: false, revokedAt: new Date(), reason },
      });
      await tx.profile.update({
        where: { id: profile.id },
        data: { role: existingGrant.previousRole },
      });
      await tx.platformAdminAuditEvent.create({
        data: {
          actorProfileId: profile.id,
          action: 'platform_admin.revoked',
          targetType: 'Profile',
          targetId: profile.id,
          metadata: { reason },
        },
      });
    });
    process.stdout.write(`Revoked platform administrator access from profile ${profile.id}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Platform admin command failed'}\n`,
  );
  process.exitCode = 1;
});
