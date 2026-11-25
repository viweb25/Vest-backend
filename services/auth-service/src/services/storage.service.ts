import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import { logger } from '../utils/logger';

export class StorageService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Uploads a file to Supabase storage with isolation per user.
   */
  async uploadFile(userId: string, requirementId: string, file: Express.Multer.File): Promise<string> {
    try {
      // Create a completely safe filename
      const ext = path.extname(file.originalname).toLowerCase();
      // Safe, randomized filename prevents path traversal and overwriting
      const safeFilename = crypto.randomBytes(16).toString('hex') + ext;
      
      // Store in path: requirements/{userId}/{requirementId}/{filename}
      const filePath = `requirements/${userId}/${requirementId}/${safeFilename}`;

      const { data, error } = await this.supabase.storage
        .from('documents')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Prevents overwriting just in case
        });

      if (error) {
        logger.error({ message: 'Supabase storage error', error });
        throw new Error('Failed to upload file to storage');
      }

      // Return the storage path
      return data.path;
    } catch (error) {
      logger.error({ message: 'Storage service error', error });
      throw new Error('Storage service error');
    }
  }

  /**
   * Delete a file belonging to a user
   */
  async deleteFile(userId: string, filePath: string) {
    // Basic verification that the path belongs to the user
    if (!filePath.startsWith(`requirements/${userId}/`)) {
      throw new Error('Unauthorized deletion attempt');
    }
    
    const { error } = await this.supabase.storage
      .from('documents')
      .remove([filePath]);

    if (error) {
      logger.error({ message: 'Failed to delete file', error });
      throw new Error('Failed to delete file');
    }
  }
}

export const storageService = new StorageService();
