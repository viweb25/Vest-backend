import { Router, Request, Response, NextFunction } from 'express';
import { requirementController } from '../controllers/requirement.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import { requirementSchema, updateRequirementSchema, verifyPaymentSchema } from '../validators/requirement.validator';

const router = Router();

// Create booking enquiry (optionalAuth allows both authenticated and guest submissions)
router.post('/', optionalAuth, validate(requirementSchema), requirementController.createRequirement);

// Get user requirements
router.get('/', requireAuth, requirementController.getRequirements);

// Get single requirement
router.get('/:id', optionalAuth, requirementController.getRequirementById);

// Update requirement
router.put('/:id', requireAuth, validate(updateRequirementSchema), requirementController.updateRequirement);

// Verify payment endpoint (kept for backward compatibility)
router.post('/:id/pay', optionalAuth, validate(verifyPaymentSchema), requirementController.verifyPayment);

// Document upload
router.post(
  '/:id/documents', 
  optionalAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  }, 
  requirementController.uploadDocument
);

export default router;
