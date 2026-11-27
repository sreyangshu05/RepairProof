import { z } from 'zod';

export const repairStageSchema = z.enum([
  'Awaiting approval',
  'In repair',
  'Ready for testing',
  'Completed',
]);
export type RepairStage = z.infer<typeof repairStageSchema>;

const repairHistoryEntrySchema = z.object({
  reference: z.string(),
  title: z.string(),
  date: z.string(),
  stage: repairStageSchema,
});

export const consumerDeviceSchema = z.object({
  id: z.string(),
  manufacturer: z.string(),
  model: z.string(),
  registrationDate: z.string(),
  repairCount: z.number().int().nonnegative(),
  warranty: z.object({ provider: z.string(), endsAt: z.string(), coverage: z.string() }).nullable(),
  latestRepair: z
    .object({
      reference: z.string(),
      title: z.string(),
      stage: repairStageSchema,
      updatedAt: z.string(),
    })
    .nullable(),
  history: z.array(repairHistoryEntrySchema),
});

export const consumerDashboardSchema = z.object({
  devices: z.array(consumerDeviceSchema),
  notifications: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string(),
      createdAt: z.string(),
      href: z.string(),
      unread: z.boolean(),
    }),
  ),
  activity: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string(),
      createdAt: z.string(),
      href: z.string(),
    }),
  ),
});

export type ConsumerDevice = z.infer<typeof consumerDeviceSchema>;
export type ConsumerDashboardData = z.infer<typeof consumerDashboardSchema>;
