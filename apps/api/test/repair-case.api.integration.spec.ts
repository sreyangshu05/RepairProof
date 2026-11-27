import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@repairproof/shared';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const integrationTest = integrationEnabled ? it : it.skip;

describe('Repair case HTTP → PostgreSQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerUserId: string;
  let ownerProfileId: string;
  let shopId: string;
  let deviceId: string;
  let caseId: string;

  beforeAll(async () => {
    if (!integrationEnabled) return;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.REDIS_URL = '';
    ownerUserId = randomUUID();
    const tokenAuth = {
      verifyAccessToken: (token: string) => {
        if (token !== 'integration-owner-token') throw new Error('invalid token');
        return { id: ownerUserId, email: 'owner@integration.invalid' };
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService)
      .useValue(tokenAuth)
      .compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.HEADER,
      header: 'X-API-Version',
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);

    const shop = await prisma.shop.create({
      data: { name: `HTTP integration ${ownerUserId}`, ownerId: ownerUserId },
    });
    shopId = shop.id;
    const owner = await prisma.profile.create({
      data: {
        userId: ownerUserId,
        email: 'owner@integration.invalid',
        displayName: 'HTTP Integration Owner',
        role: UserRole.SHOP_OWNER,
        shopId,
      },
    });
    ownerProfileId = owner.id;
    await prisma.organizationMembership.create({
      data: { shopId, profileId: ownerProfileId, role: UserRole.SHOP_OWNER },
    });
  });

  afterAll(async () => {
    if (!integrationEnabled || !prisma) return;
    try {
      const cases = await prisma.repairCase.findMany({ where: { shopId }, select: { id: true } });
      const caseIds = cases.map((item) => item.id);
      await prisma.notification.deleteMany({ where: { profileId: ownerProfileId } });
      await prisma.auditEvent.deleteMany({ where: { shopId } });
      if (caseIds.length)
        await prisma.repairCaseTransition.deleteMany({ where: { caseId: { in: caseIds } } });
      await prisma.repairCase.deleteMany({ where: { shopId } });
      await prisma.device.deleteMany({ where: { shopId } });
    } finally {
      await prisma.organizationMembership.deleteMany({ where: { shopId } });
      await prisma.profile.deleteMany({ where: { id: ownerProfileId } });
      await prisma.shop.deleteMany({ where: { id: shopId } });
      await app.close();
    }
  });

  integrationTest(
    'authenticates a shop owner, creates a device and case over HTTP, then reads persisted workspace data',
    async () => {
      const api = request(app.getHttpServer());
      const auth = { Authorization: 'Bearer integration-owner-token', 'X-API-Version': '1' };
      const deviceResponse = await api
        .post('/devices')
        .set(auth)
        .send({
          category: 'SMARTPHONE',
          make: 'RepairProof Fixture',
          model: 'HTTP Test Device',
          intakeCondition: 'Integration fixture only',
        })
        .expect(201);
      deviceId = deviceResponse.body.data.id;
      expect(deviceId).toBeTruthy();

      const caseResponse = await api.post('/cases').set(auth).send({
        deviceId,
        customerName: 'HTTP Integration Customer',
        customerPhone: '+15555550100',
        problemDescription: 'HTTP to database persistence verification',
      });
      if (caseResponse.status !== 201)
        throw new Error(
          `Case creation returned ${caseResponse.status}: ${JSON.stringify(caseResponse.body)}`,
        );
      caseId = caseResponse.body.data.id;

      await api
        .patch(`/cases/${caseId}/status`)
        .set({ ...auth, 'Idempotency-Key': 'http-submit-case' })
        .send({ status: 'SUBMITTED' })
        .expect(200);
      const workspaceResponse = await api.get('/cases/workspace').set(auth).expect(200);
      expect(workspaceResponse.body.data.cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: caseId,
            reference: caseResponse.body.data.caseNumber,
            status: 'assigned',
            device: expect.objectContaining({
              manufacturer: 'RepairProof Fixture',
              model: 'HTTP Test Device',
            }),
          }),
        ]),
      );

      const persisted = await prisma.repairCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(persisted.status).toBe('SUBMITTED');
      expect(persisted.deviceId).toBe(deviceId);
    },
  );

  integrationTest('rejects invalid credentials before returning protected case data', async () => {
    await request(app.getHttpServer())
      .get('/cases/workspace')
      .set({ Authorization: 'Bearer invalid-integration-token', 'X-API-Version': '1' })
      .expect(401);
  });
});
