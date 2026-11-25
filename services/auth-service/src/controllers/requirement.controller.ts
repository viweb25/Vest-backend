import { Request, Response, NextFunction } from 'express';
import { requirementService } from '../services/requirement.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class RequirementController {
  async createRequirement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const result = await requirementService.createRequirement(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Booking enquiry submitted successfully. Meeting link has been sent to your email.',
        data: {
          requirement: result,
          meetingLink: result.meetingLink,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRequirements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new Error('User missing from request');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await requirementService.getRequirements(req.user.id, page, limit);
      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRequirementById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const requirement = await requirementService.getRequirementById(userId, req.params.id);
      res.json({
        success: true,
        data: { requirement },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRequirement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new Error('User missing from request');
      const requirement = await requirementService.updateRequirement(req.user.id, req.params.id, req.body);
      res.json({
        success: true,
        message: 'Requirement updated successfully',
        data: { requirement },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new Error('User missing from request');
      const requirement = await requirementService.getRequirementById(req.user.id, req.params.id);
      res.json({
        success: true,
        message: 'Payment verification no longer required.',
        data: { requirement },
      });
    } catch (error) {
      next(error);
    }
  }

  uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      const userId = req.user?.id || 'guest';
      const requirement = await requirementService.getRequirementById(req.user?.id, req.params.id);

      const { storageService } = require('../services/storage.service');
      const path = await storageService.uploadFile(userId, requirement.id, file);

      const updatedRequirement = await requirementService.addDocument(userId, requirement.id, path);

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: { requirement: updatedRequirement },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const requirementController = new RequirementController();
