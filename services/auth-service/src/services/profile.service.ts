import { prisma } from '../lib/prisma';
import { NotFoundError } from '../utils/errors';

export class ProfileService {
  async getProfile(userId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    return {
      fullName: user.name,
      email: user.email,
      companyName: profile?.companyName || null,
      phone: profile?.phone || null,
      designation: profile?.designation || null,
      city: profile?.city || null,
      country: profile?.country || null,
      contactMethod: profile?.contactMethod || null,
      bestTimeToContact: profile?.bestTimeToContact || null,
    };
  }

  async updateProfile(userId: string, data: any) {
    if (data.fullName) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: data.fullName },
      });
    }

    await prisma.profile.upsert({
      where: { userId },
      update: {
        companyName: data.companyName,
        phone: data.phone,
        designation: data.designation,
        city: data.city,
        country: data.country,
        contactMethod: data.contactMethod,
        bestTimeToContact: data.bestTimeToContact,
      },
      create: {
        userId,
        companyName: data.companyName,
        phone: data.phone,
        designation: data.designation,
        city: data.city,
        country: data.country,
        contactMethod: data.contactMethod,
        bestTimeToContact: data.bestTimeToContact,
      },
    });

    return this.getProfile(userId);
  }
}

export const profileService = new ProfileService();
