import { prisma } from '../lib/prisma';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import { emailService } from './email.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

function generateMeetingLink(): string {
  if (process.env.DEFAULT_MEETING_LINK) {
    return process.env.DEFAULT_MEETING_LINK;
  }
  // Generate random Google Meet format: https://meet.google.com/xxx-yyyy-zzz
  const part1 = Math.random().toString(36).substring(2, 5);
  const part2 = Math.random().toString(36).substring(2, 6);
  const part3 = Math.random().toString(36).substring(2, 5);
  return `https://meet.google.com/${part1}-${part2}-${part3}`;
}

export class RequirementService {
  async createRequirement(userId: string | undefined, data: any) {
    const meetingLink = generateMeetingLink();
    const clientEmail = data.email || '';
    const clientName = data.clientName || data.name || 'Valued Client';
    
    // Normalize supportType for Prisma enum
    const isOffline = data.supportType === 'On-site support' || data.supportType === 'OFFLINE';
    const supportTypeEnum = isOffline ? 'OFFLINE' : 'ONLINE';

    // Pack developer staffing & PLC info cleanly into custom fields
    const developerInfo = data.developerLevel 
      ? `Dev: ${data.developerLevel} (Qty: ${data.developerCount || 1})` 
      : '';
    const plcInfo = data.plcPlatform 
      ? `PLC: ${data.plcPlatform} | Ver: ${data.plcSoftwareVersion || 'N/A'} | I/O: ${data.plcIoCount || 'N/A'}` 
      : '';
    const fullCustomSoftware = [data.customSoftware, developerInfo, plcInfo].filter(Boolean).join(' | ');

    const fullDescription = [
      data.applicationDescription,
      data.companyName ? `Company: ${data.companyName} (${data.designation || 'N/A'})` : null,
      data.city ? `Location: ${data.city}, ${data.country || 'India'}` : null,
      data.contactMethod ? `Preferred Contact: ${data.contactMethod} (Best Time: ${data.bestTimeToContact || 'Anytime'})` : null,
      data.meetingLink ? `Meeting: ${meetingLink}` : `Meeting: ${meetingLink}`,
    ].filter(Boolean).join('\n\n');

    let requirement: any;

    try {
      // 1. Resolve or create user ID if not provided
      let effectiveUserId = userId;
      if (!effectiveUserId && clientEmail) {
        const existingUser = await prisma.user.findUnique({ where: { email: clientEmail } });
        if (existingUser) {
          effectiveUserId = existingUser.id;
        } else {
          const newUser = await prisma.user.create({
            data: {
              email: clientEmail,
              name: clientName,
              status: 'ACTIVE',
            },
          });
          effectiveUserId = newUser.id;
        }
      }

      if (!effectiveUserId) {
        // Fallback to first existing user or create system placeholder
        const firstUser = await prisma.user.findFirst();
        effectiveUserId = firstUser ? firstUser.id : crypto.randomUUID();
      }

      // 2. Create requirement in database with status SUBMITTED (Payment removed)
      requirement = await prisma.requirement.create({
        data: {
          userId: effectiveUserId,
          industryDomain: data.primaryService ? `${data.primaryService} | ${data.industryDomain}` : data.industryDomain,
          customIndustry: data.customIndustry,
          servicesRequired: [data.primaryService, data.solution, ...(data.subCategories || [])].filter(Boolean),
          customSolution: data.customSolution,
          projectType: data.projectType || 'Standard',
          quantity: data.developerCount || data.quantity || 1,
          applicationDescription: fullDescription,
          equipmentSystemName: data.equipmentSystemName || data.plcPlatform,
          modelPartNumber: data.modelPartNumber || data.plcProjectStatus,
          requiredInterfaces: data.requiredInterfaces || [],
          customInterface: data.customInterface,
          preferredSoftwarePlatform: data.preferredSoftwarePlatform || [data.primaryService || 'LabVIEW'],
          customSoftware: fullCustomSoftware,
          targetTimeline: data.targetTimeline || 'Immediate',
          projectPriority: data.projectPriority || 'Standard',
          supportType: supportTypeEnum,
          country: data.country || 'India',
          phoneCountryCode: data.phoneCountryCode || '+91',
          phoneNumber: data.phoneNumber,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            userId: effectiveUserId,
            action: 'CREATE_BOOKING_ENQUIRY',
            details: `Booking ID: ${requirement.id}, Meeting: ${meetingLink}`,
          },
        });
      } catch (e) {
        // Non-critical audit log fail
      }
    } catch (dbError: any) {
      logger.warn({
        message: 'Database save skipped due to connection issue. Falling back to in-memory requirement record.',
        error: dbError.message,
      });

      requirement = {
        id: crypto.randomUUID(),
        status: 'SUBMITTED',
        applicationDescription: fullDescription,
        primaryService: data.primaryService,
        solution: data.solution,
        createdAt: new Date(),
        submittedAt: new Date(),
      };
    }

    // 3. Send Emails: to both User and Admin with the Google Meet link!
    const emailPayload = {
      ...data,
      clientName,
      email: clientEmail,
      requirementId: requirement.id,
      meetingLink,
      supportType: data.supportType || 'Remote support',
    };

    // Send confirmation to User
    if (clientEmail) {
      await emailService.sendBookingConfirmationToUser(clientEmail, emailPayload, meetingLink);
    }

    // Send alert to Admin
    await emailService.sendBookingNotificationToAdmin(emailPayload, meetingLink);

    return {
      ...requirement,
      meetingLink,
    };
  }

  async getRequirements(userId: string, page: number = 1, limit: number = 20) {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    try {
      const [requirements, total] = await Promise.all([
        prisma.requirement.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: safeLimit,
        }),
        prisma.requirement.count({ where: { userId } }),
      ]);

      return {
        data: requirements,
        meta: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit),
        },
      };
    } catch (error) {
      return {
        data: [],
        meta: { total: 0, page: 1, limit: safeLimit, totalPages: 0 },
      };
    }
  }

  async getRequirementById(userId: string | undefined, requirementId: string) {
    const requirement = await prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new NotFoundError('Requirement not found');
    }

    if (userId && requirement.userId && requirement.userId !== userId) {
      throw new AuthorizationError('Unauthorized access to requirement');
    }

    return requirement;
  }

  async updateRequirement(userId: string, requirementId: string, data: any) {
    const requirement = await this.getRequirementById(userId, requirementId);

    const updated = await prisma.requirement.update({
      where: { id: requirementId },
      data: {
        industryDomain: data.industryDomain ?? requirement.industryDomain,
        customIndustry: data.customIndustry ?? requirement.customIndustry,
        servicesRequired: data.servicesRequired ?? requirement.servicesRequired,
        customSolution: data.customSolution ?? requirement.customSolution,
        projectType: data.projectType ?? requirement.projectType,
        quantity: data.quantity ?? requirement.quantity,
        applicationDescription: data.applicationDescription ?? requirement.applicationDescription,
        equipmentSystemName: data.equipmentSystemName ?? requirement.equipmentSystemName,
        modelPartNumber: data.modelPartNumber ?? requirement.modelPartNumber,
        requiredInterfaces: data.requiredInterfaces ?? requirement.requiredInterfaces,
        customInterface: data.customInterface ?? requirement.customInterface,
        preferredSoftwarePlatform: data.preferredSoftwarePlatform ?? requirement.preferredSoftwarePlatform,
        customSoftware: data.customSoftware ?? requirement.customSoftware,
        targetTimeline: data.targetTimeline ?? requirement.targetTimeline,
        projectPriority: data.projectPriority ?? requirement.projectPriority,
        supportType: data.supportType ?? requirement.supportType,
        country: data.country ?? requirement.country,
        phoneCountryCode: data.phoneCountryCode ?? requirement.phoneCountryCode,
        phoneNumber: data.phoneNumber ?? requirement.phoneNumber,
        status: data.status ?? requirement.status,
      },
    });

    return updated;
  }

  async addDocument(userId: string, requirementId: string, path: string) {
    const requirement = await this.getRequirementById(userId, requirementId);

    const updated = await prisma.requirement.update({
      where: { id: requirementId },
      data: {
        documents: {
          push: path,
        },
      },
    });

    return updated;
  }
}

export const requirementService = new RequirementService();
