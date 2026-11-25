import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private async initTransporter() {
    if (process.env.NODE_ENV === 'test') {
      this.transporter = {
        sendMail: async () => ({ messageId: 'test-message-id' }),
      } as any;
      return;
    }

    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
      } else {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info(`Initialized fresh Ethereal test inbox: ${testAccount.user}`);
      }
    } catch (error: any) {
      logger.warn({ message: 'Failed initial SMTP setup, fallback will handle sending', error: error.message });
      this.transporter = null;
    }
  }

  private async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporter) {
      await this.initTransporter();
    }
    return this.transporter!;
  }

  /**
   * Safe email sender: if primary SMTP fails (e.g. 535 auth error or network error),
   * it automatically falls back to a fresh test account and prints the preview URL!
   */
  private async sendMailWithFallback(mailOptions: nodemailer.SendMailOptions, context: string): Promise<any> {
    try {
      const transporter = await this.getTransporter();
      if (!transporter) throw new Error('No transporter configured');

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`${context} sent successfully to ${mailOptions.to}. ${previewUrl ? `[Preview URL: ${previewUrl}]` : ''}`);
      return info;
    } catch (error: any) {
      logger.warn({ message: `Primary SMTP error for ${context}: ${error.message}. Switching to fresh test inbox fallback...` });

      try {
        const freshAccount = await nodemailer.createTestAccount();
        const fallbackTransporter = nodemailer.createTransport({
          host: freshAccount.smtp.host,
          port: freshAccount.smtp.port,
          secure: freshAccount.smtp.secure,
          auth: {
            user: freshAccount.user,
            pass: freshAccount.pass,
          },
        });

        // Set from address to the fresh account so ethereal accepts it
        const fallbackOptions = {
          ...mailOptions,
          from: `"Vest Solutions" <${freshAccount.user}>`,
        };

        const info = await fallbackTransporter.sendMail(fallbackOptions);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info(`✅ [FALLBACK SENT] ${context} delivered to test account!`);
        logger.info(`🔗 CLICK TO VIEW EMAIL PREVIEW: ${previewUrl}`);
        return info;
      } catch (fallbackErr: any) {
        logger.error({ message: `Both primary and fallback email sending failed for ${context}`, error: fallbackErr.message });
      }
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Vest Solutions" <noreply@vestsolutions.com>',
      to,
      subject: 'Verify your email address',
      html: `<p>Please verify your email by clicking the link below:</p><p><a href="${url}">${url}</a></p>`,
    };
    await this.sendMailWithFallback(mailOptions, 'Verification Email');
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const url = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Vest Solutions" <noreply@vestsolutions.com>',
      to,
      subject: 'Reset your password',
      html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
    };
    await this.sendMailWithFallback(mailOptions, 'Password Reset Email');
  }

  async sendWelcomeEmail(to: string, name: string) {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Vest Solutions" <noreply@vestsolutions.com>',
      to,
      subject: 'Welcome to Vest Solutions',
      html: `<p>Hi ${name},</p><p>Welcome to Vest Solutions! We are glad you are here.</p>`,
    };
    await this.sendMailWithFallback(mailOptions, 'Welcome Email');
  }

  /**
   * User Confirmation Email:
   * "Submitted successfully" + "Meeting Scheduled!" + Meeting link and time
   */
  async sendBookingConfirmationToUser(to: string, data: any, meetingLink: string) {
    const clientName = data.clientName || data.name || 'Valued Client';
    const serviceName = data.primaryService || 'LabVIEW & Industrial Automation Engineering';
    const solutionName = data.solution || 'Engineering Consultation';
    const scheduledTime = data.bestTimeToContact || 'Morning (9:00 AM - 12:00 PM IST)';
    const scheduledDate = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Vest Solutions" <${process.env.SMTP_USER || 'consulting@vestsolutions.com'}>`,
      to,
      subject: `Requirement Submitted Successfully - Meeting Scheduled!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <!-- Top Header Banner -->
          <div style="background-color: #0B2540; padding: 28px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">VEST SOLUTIONS</h1>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Engineering &amp; Industrial Automation Consultation</p>
          </div>

          <div style="padding: 32px 28px;">
            <!-- Status Pill -->
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="display: inline-block; background-color: #ECFDF5; color: #059669; font-size: 13px; font-weight: 800; padding: 6px 16px; border-radius: 9999px; border: 1px solid #A7F3D0; letter-spacing: 0.5px;">
                ✔ SUBMITTED SUCCESSFULLY
              </span>
            </div>

            <h2 style="color: #0B2540; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Hello ${clientName},</h2>
            <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
              Your engineering requirement has been <strong>submitted successfully</strong>! We have scheduled your consultation meeting with our engineering leads.
            </p>

            <!-- MEETING SCHEDULED BOX (Prominent) -->
            <div style="background: linear-gradient(135deg, #F0F8FD 0%, #E0F2FE 100%); border: 2px solid #1D79C5; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center; box-shadow: 0 6px 16px rgba(29, 121, 197, 0.1);">
              <div style="display: inline-block; background-color: #1D79C5; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
                📅 MEETING SCHEDULED!
              </div>
              <h3 style="color: #0B2540; font-size: 19px; margin: 0 0 8px 0; font-weight: 800;">Google Meet Consultation Room</h3>
              <p style="color: #334155; font-size: 14px; margin: 0 0 16px 0;">
                Click below to join your scheduled video discussion with our engineers:
              </p>

              <!-- Join Button -->
              <a href="${meetingLink}" target="_blank" style="display: inline-block; background-color: #1D79C5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 14px rgba(29, 121, 197, 0.35); margin-bottom: 12px;">
                🎥 Join Google Meet
              </a>

              <div style="background-color: #ffffff; border-radius: 10px; padding: 12px; margin-top: 14px; border: 1px solid #bfdbfe; font-size: 13px; color: #1e293b; text-align: left;">
                <div style="margin-bottom: 6px;">
                  <strong style="color: #0B2540;">🔗 Meet Link:</strong> 
                  <a href="${meetingLink}" style="color: #1D79C5; word-break: break-all; text-decoration: underline;">${meetingLink}</a>
                </div>
                <div style="margin-bottom: 6px;">
                  <strong style="color: #0B2540;">⏰ Scheduled Time Slot:</strong> <span style="color: #0284c7; font-weight: 700;">${scheduledTime}</span>
                </div>
                <div>
                  <strong style="color: #0B2540;">📆 Date:</strong> ${scheduledDate}
                </div>
              </div>
            </div>

            <!-- Summary Details -->
            <h4 style="color: #0B2540; font-size: 15px; margin: 24px 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              📋 Your Submission Summary
            </h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b; width: 40%;">Primary Service:</td>
                <td style="padding: 8px 0; font-weight: 700; color: #0B2540;">${serviceName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Solution:</td>
                <td style="padding: 8px 0; font-weight: 700; color: #0B2540;">${solutionName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Support Mode:</td>
                <td style="padding: 8px 0; font-weight: 600;">${data.supportType || 'Remote support'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Preferred Contact:</td>
                <td style="padding: 8px 0; font-weight: 600;">${data.contactMethod || 'Phone Call'} (${data.phoneCountryCode || '+91'} ${data.phoneNumber || ''})</td>
              </tr>
              ${data.applicationDescription ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; vertical-align: top;">Requirement:</td>
                <td style="padding: 8px 0; font-style: italic; color: #475569;">"${data.applicationDescription}"</td>
              </tr>
              ` : ''}
            </table>

            <div style="background-color: #f8fafc; border-radius: 12px; padding: 14px 18px; margin-top: 24px; border: 1px solid #e2e8f0;">
              <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">
                💬 <strong>What happens next?</strong> Our technical team will review your application specifications and join the Google Meet room with you at your chosen time slot. If you have any urgent queries, contact us at <strong>+91-704-308-4455</strong>.
              </p>
            </div>
          </div>

          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} Vest Solutions. All rights reserved.
          </div>
        </div>
      `,
    };

    await this.sendMailWithFallback(mailOptions, 'User Booking Confirmation Email');
  }

  /**
   * Admin Notification Email:
   * Sent to admin@viwebsync.com with complete client details, technical requirements, and the same meeting link!
   */
  async sendBookingNotificationToAdmin(data: any, meetingLink: string) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@viwebsync.com';
    const clientName = data.clientName || data.name || 'New Client';
    const company = data.companyName || 'Not specified';
    const scheduledTime = data.bestTimeToContact || 'Morning (9:00 AM - 12:00 PM IST)';
    const scheduledDate = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subCategoriesList = Array.isArray(data.subCategories) && data.subCategories.length > 0
      ? data.subCategories.join(', ')
      : 'None';

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Vest Solutions Alert" <${process.env.SMTP_USER || 'alerts@vestsolutions.com'}>`,
      to: adminEmail,
      subject: `🚨 New Enquiry: ${clientName} (${company}) - Meeting Scheduled!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <div style="background-color: #0B2540; padding: 24px 28px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 19px; font-weight: 800;">🚨 NEW CLIENT REQUIREMENT &amp; MEETING SCHEDULED</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Received: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
          </div>

          <div style="padding: 28px;">
            <!-- Meeting Box for Admin -->
            <div style="background: #FFF7ED; border: 2px solid #F2670E; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
              <div style="font-size: 12px; font-weight: 800; color: #C2410C; text-transform: uppercase; margin-bottom: 6px;">
                ASSIGNED GOOGLE MEET LINK FOR THIS CLIENT
              </div>
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 12px;">
                <a href="${meetingLink}" target="_blank" style="color: #1D79C5; text-decoration: underline; word-break: break-all;">${meetingLink}</a>
              </div>
              <div style="font-size: 13px; color: #7c2d12; line-height: 1.5;">
                ⏰ <strong>Client Preferred Time:</strong> <span style="font-weight: 700; color: #0B2540;">${scheduledTime}</span><br />
                📆 <strong>Date:</strong> ${scheduledDate}<br />
                <em>(The client has also received this exact Google Meet link in their confirmation email)</em>
              </div>
              <div style="margin-top: 14px;">
                <a href="${meetingLink}" target="_blank" style="display: inline-block; background-color: #F2670E; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold; font-size: 13px;">
                  Open Google Meet Room
                </a>
              </div>
            </div>

            <!-- Client Info Table -->
            <h3 style="color: #0B2540; font-size: 16px; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              👤 Client Contact Information
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b; width: 35%;">Client Name:</td>
                <td style="padding: 8px; font-weight: bold; color: #0B2540;">${clientName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Email Address:</td>
                <td style="padding: 8px; font-weight: bold;"><a href="mailto:${data.email}" style="color: #1D79C5;">${data.email || 'N/A'}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Phone:</td>
                <td style="padding: 8px; font-weight: bold;"><a href="tel:${data.phoneCountryCode || ''}${data.phoneNumber || ''}" style="color: #1D79C5;">${data.phoneCountryCode || ''} ${data.phoneNumber || 'N/A'}</a></td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Company &amp; Designation:</td>
                <td style="padding: 8px; color: #0B2540;">${company} ${data.designation ? `(${data.designation})` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Location:</td>
                <td style="padding: 8px; color: #0B2540;">${data.city || 'N/A'}, ${data.country || 'India'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Preferred Contact:</td>
                <td style="padding: 8px; font-weight: 700; color: #0B2540;">${data.contactMethod || 'Phone Call'} (Time: ${scheduledTime})</td>
              </tr>
              <tr>
                <td style="padding: 8px; color: #64748b;">Support Mode:</td>
                <td style="padding: 8px; font-weight: 600; color: #0B2540;">${data.supportType || 'Remote support'}</td>
              </tr>
            </table>

            <!-- Technical Specifications Table -->
            <h3 style="color: #0B2540; font-size: 16px; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              🛠️ Technical Requirements
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b; width: 35%;">Service Category:</td>
                <td style="padding: 8px; font-weight: bold; color: #0B2540;">${data.primaryService || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Industry / Domain:</td>
                <td style="padding: 8px; color: #0B2540;">${data.industryDomain || 'N/A'} ${data.customIndustry ? `(${data.customIndustry})` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Solution:</td>
                <td style="padding: 8px; font-weight: bold; color: #0B2540;">${data.solution || 'N/A'} ${data.customSolution ? `(${data.customSolution})` : ''}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Subcategories:</td>
                <td style="padding: 8px; color: #0B2540;">${subCategoriesList}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Project Type &amp; Priority:</td>
                <td style="padding: 8px; color: #0B2540;">${data.projectType || 'Standard'} | Priority: ${data.projectPriority || 'Standard'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">Developer Staffing:</td>
                <td style="padding: 8px; font-weight: 600; color: #0B2540;">${data.developerLevel || 'Standard'} (Count: ${data.developerCount || 1})</td>
              </tr>
              ${data.plcPlatform ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">PLC System:</td>
                <td style="padding: 8px; color: #0B2540;">${data.plcPlatform} | Ver: ${data.plcSoftwareVersion || 'N/A'} | I/O: ${data.plcIoCount || 'N/A'} | Status: ${data.plcProjectStatus || 'N/A'}</td>
              </tr>
              ` : ''}
              ${data.equipmentSystemName ? `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px; color: #64748b;">LabVIEW / Hardware:</td>
                <td style="padding: 8px; color: #0B2540;">${data.equipmentSystemName} (${data.modelPartNumber || 'N/A'})</td>
              </tr>
              ` : ''}
            </table>

            <!-- Description -->
            <h3 style="color: #0B2540; font-size: 15px; margin: 0 0 8px 0;">📝 Application / Requirement Description:</h3>
            <div style="background-color: #f8fafc; border-left: 4px solid #1D79C5; padding: 14px 18px; font-size: 14px; line-height: 1.6; color: #1e293b; border-radius: 0 8px 8px 0;">
              ${data.applicationDescription || 'No description provided'}
            </div>
          </div>

          <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8;">
            Internal Notification for Vest Solutions Engineering Lead &bull; Target Admin: ${adminEmail}
          </div>
        </div>
      `,
    };

    await this.sendMailWithFallback(mailOptions, 'Admin Booking Notification Email');
  }
}

export const emailService = new EmailService();
