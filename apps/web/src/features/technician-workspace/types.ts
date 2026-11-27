import { z } from 'zod';

export const caseStatusSchema = z.enum([
  'incoming',
  'assigned',
  'diagnosing',
  'pending_approval',
  'approved',
  'in_repair',
  'testing',
  'completed',
  'rejected',
  'disputed',
  'cancelled',
]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const technicianCaseSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: caseStatusSchema,
  priority: z.enum(['standard', 'time-sensitive']),
  customerName: z.string(),
  customerContact: z.string().optional(),
  device: z.object({
    manufacturer: z.string(),
    model: z.string(),
    serialLast4: z.string().optional(),
    registeredAt: z.string().optional(),
  }),
  issueSummary: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignedTechnician: z.string().nullable(),
  diagnostics: z
    .object({
      symptoms: z.string(),
      findings: z.string(),
      recommendedWork: z.string(),
      safetyNotes: z.string(),
    })
    .nullable(),
  evidence: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      addedAt: z.string(),
      url: z.string().optional(),
    }),
  ),
  quotation: z
    .object({
      version: z.number().int().positive(),
      status: z.enum(['draft', 'sent', 'approved', 'declined']),
      currency: z.string(),
      items: z.array(
        z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number() }),
      ),
      customerNote: z.string().optional(),
    })
    .nullable(),
  tests: z.array(
    z.object({
      name: z.string(),
      result: z.enum(['pass', 'fail', 'not_applicable']),
      note: z.string().optional(),
    }),
  ),
  warranty: z
    .object({ durationMonths: z.number(), startsAt: z.string(), terms: z.string() })
    .nullable(),
});

export const technicianWorkspaceSchema = z.object({
  cases: z.array(technicianCaseSchema),
  technician: z.object({ id: z.string(), displayName: z.string(), organizationName: z.string() }),
});

export type TechnicianCase = z.infer<typeof technicianCaseSchema>;
export type TechnicianWorkspaceData = z.infer<typeof technicianWorkspaceSchema>;
export type CaseActionInput = {
  path: string;
  method?: 'POST' | 'PATCH';
  body: Record<string, unknown>;
};
