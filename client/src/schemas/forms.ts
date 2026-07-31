import { z } from 'zod';

const githubSlugPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export const assessmentFormSchema = z
  .object({
    organizations: z.string().refine(
      (value) =>
        value
          .split(',')
          .map((organization) => organization.trim())
          .filter(Boolean)
          .every((organization) => githubSlugPattern.test(organization)),
      'Enter comma-separated GitHub organization slugs.'
    ),
    period: z.enum(['7', '30', 'custom']),
    customDays: z.coerce.number().int().min(1, 'Use at least 1 day.').max(90, 'Use no more than 90 days.'),
  })
  .refine((values) => values.period !== 'custom' || values.customDays >= 1, {
    path: ['customDays'],
    message: 'Enter a custom assessment period.',
  });

export type AssessmentFormValues = z.infer<typeof assessmentFormSchema>;

export const licensePoolFormSchema = z
  .object({
    enterpriseName: z.string().trim().min(1, 'Enterprise name is required.').max(100, 'Use 100 characters or fewer.'),
    licenseCountBusiness: z.coerce.number().int().min(0, 'License count cannot be negative.'),
    licenseCountEnterprise: z.coerce.number().int().min(0, 'License count cannot be negative.'),
    licenseCountCloudAgent: z.coerce.number().int().min(0, 'License count cannot be negative.'),
    licenseCountSpark: z.coerce.number().int().min(0, 'License count cannot be negative.'),
    billingCycleStartDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid billing-cycle date.'),
    currentDayOfCycle: z.coerce.number().int().min(1, 'Use day 1 or later.').max(31, 'Use day 31 or earlier.'),
    creditsConsumedSoFar: z.coerce.number().min(0, 'Consumed credits cannot be negative.'),
  })
  .refine(
    (values) =>
      values.licenseCountBusiness +
        values.licenseCountEnterprise +
        values.licenseCountCloudAgent +
        values.licenseCountSpark >
      0,
    {
      path: ['licenseCountBusiness'],
      message: 'Enter at least one licensed user.',
    }
  );

export type LicensePoolFormValues = z.infer<typeof licensePoolFormSchema>;

export const populationAllocationSchema = z.object({
  universalUlb: z.coerce.number().int().min(0),
  overageUsers: z.coerce.number().int().min(0),
  abundantUsers: z.coerce.number().int().min(0),
  exponentialUsers: z.coerce.number().int().min(0),
});

export function createPopulationAllocationFormSchema(totalUsers: number) {
  return populationAllocationSchema.refine(
    (allocation) => Object.values(allocation).reduce((total, count) => total + count, 0) === totalUsers,
    {
      path: ['universalUlb'],
      message: `Allocation must total ${totalUsers.toLocaleString()} licensed users.`,
    }
  );
}

export const scenarioFormSchema = z.object({
  scenarioName: z.string().trim().max(60, 'Use 60 characters or fewer.'),
});

export type ScenarioFormValues = z.infer<typeof scenarioFormSchema>;
