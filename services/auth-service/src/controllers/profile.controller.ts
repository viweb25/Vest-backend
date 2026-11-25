import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class ProfileController {
  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new Error('User missing from request');
      const profile = await profileService.getProfile(req.user.id);
      res.json({
        success: true,
        data: { profile },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new Error('User missing from request');
      
      const profile = await profileService.updateProfile(req.user.id, req.body);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { profile },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
