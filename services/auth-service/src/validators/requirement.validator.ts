import { z } from 'zod';

export const requirementSchema = z.object({
  body: z.object({
    // Client & Contact Information
    name: z.string().optional(),
    clientName: z.string().optional(),
    email: z.string().email('Valid email is required').optional(),
    companyName: z.string().optional(),
    designation: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional().default('India'),
    phoneCountryCode: z.string().optional().default('+91'),
    phoneNumber: z.string().optional(),
    contactMethod: z.string().optional().default('Phone Call'),
    bestTimeToContact: z.string().optional().default('Morning (9am - 12pm)'),

    // Service & Solution
    primaryService: z.string().optional().default('LabVIEW Engineering'),
    industryDomain: z.string().optional().default('General Engineering'),
    customIndustry: z.string().optional(),
    solution: z.string().optional().default('Engineering Consultation'),
    servicesRequired: z.array(z.string()).optional(),
    subCategories: z.array(z.string()).optional(),
    customSolution: z.string().optional(),
    projectType: z.string().optional().default('Standard'),
    quantity: z.number().int().min(1).optional().default(1),

    // Technical Details (Flexible & Optional with defaults so submission never fails)
    applicationDescription: z.string().optional().default('Engineering consultation & requirement discussion.'),
    equipmentSystemName: z.string().optional(),
    modelPartNumber: z.string().optional(),
    requiredInterfaces: z.array(z.string()).optional(),
    customInterface: z.string().optional(),
    preferredSoftwarePlatform: z.array(z.string()).optional(),
    customSoftware: z.string().optional(),
    targetTimeline: z.string().optional().default('Immediate'),
    projectPriority: z.string().optional().default('Standard'),
    supportType: z.string().optional().default('Remote support'),

    // Developer staffing
    developerLevel: z.string().optional(),
    developerCount: z.number().optional().default(1),
    developerLevels: z.array(z.string()).optional(),

    // PLC Specifics
    plcPlatform: z.string().optional(),
    plcSoftwareVersion: z.string().optional(),
    plcIoCount: z.string().optional(),
    plcProjectStatus: z.string().optional(),
  }),
});

export const updateRequirementSchema = z.object({
  body: requirementSchema.shape.body.partial(),
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    paymentId: z.string().min(1, 'Payment ID is required'),
    paymentOrderId: z.string().optional(),
    paymentAmount: z.number().min(0, 'Payment amount must be non-negative'),
    paymentCurrency: z.string().min(3).optional(),
  }),
});
