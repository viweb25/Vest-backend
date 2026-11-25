import request from 'supertest';
import app from '../app';
import { emailService } from '../services/email.service';

describe('Booking Submission & Meeting Link Flow', () => {
  it('should create booking, return 201 with meetingLink, and trigger emails without requiring payment', async () => {
    // Spy on emailService
    const userEmailSpy = jest.spyOn(emailService, 'sendBookingConfirmationToUser').mockResolvedValue(undefined as any);
    const adminEmailSpy = jest.spyOn(emailService, 'sendBookingNotificationToAdmin').mockResolvedValue(undefined as any);

    const bookingPayload = {
      name: 'Ramesh Sundaram',
      clientName: 'Ramesh Sundaram',
      email: 'ramesh.sundaram@testclient.com',
      companyName: 'Apex Industrial Systems',
      designation: 'Operations Lead',
      city: 'Coimbatore',
      country: 'India',
      phoneCountryCode: '+91',
      phoneNumber: '9876543210',
      contactMethod: 'WhatsApp',
      bestTimeToContact: 'Morning',

      primaryService: 'LabVIEW Engineering',
      industryDomain: 'Industrial Automation',
      solution: 'LabVIEW Development',
      servicesRequired: ['LabVIEW Engineering', 'LabVIEW Development', 'DAQ application'],
      subCategories: ['DAQ application', 'HMI / GUI development'],
      projectType: 'New System',
      targetTimeline: 'Within 1 Month',
      projectPriority: 'High',
      supportType: 'Remote support',

      applicationDescription: 'We need automated data acquisition and test panel integration for multi-sensor vibration logging.',
      developerLevel: 'Senior developer (1 developer)',
      developerCount: 1,
    };

    const res = await request(app)
      .post('/api/requirements')
      .send(bookingPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.meetingLink).toMatch(/^https:\/\/meet\.google\.com\//);
    expect(res.body.data.requirement.status).toBe('SUBMITTED');

    // Verify both User and Admin emails were called with the meeting link
    expect(userEmailSpy).toHaveBeenCalledTimes(1);
    expect(userEmailSpy).toHaveBeenCalledWith(
      'ramesh.sundaram@testclient.com',
      expect.objectContaining({
        clientName: 'Ramesh Sundaram',
        primaryService: 'LabVIEW Engineering',
        meetingLink: expect.stringMatching(/^https:\/\/meet\.google\.com\//),
      }),
      expect.stringMatching(/^https:\/\/meet\.google\.com\//)
    );

    expect(adminEmailSpy).toHaveBeenCalledTimes(1);
    expect(adminEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'Ramesh Sundaram',
        companyName: 'Apex Industrial Systems',
        meetingLink: expect.stringMatching(/^https:\/\/meet\.google\.com\//),
      }),
      expect.stringMatching(/^https:\/\/meet\.google\.com\//)
    );

    userEmailSpy.mockRestore();
    adminEmailSpy.mockRestore();
  });
});

