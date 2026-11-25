import { requirementService } from './src/services/requirement.service';
import { emailService } from './src/services/email.service';

async function test() {
  (emailService as any).sendBookingConfirmationToUser = async (to: string, data: any, link: string) => {
    console.log(`[USER EMAIL SENT] To: ${to}, MeetingLink: ${link}`);
  };
  (emailService as any).sendBookingNotificationToAdmin = async (data: any, link: string) => {
    console.log(`[ADMIN EMAIL SENT] Client: ${data.clientName}, MeetingLink: ${link}`);
  };

  const res = await requirementService.createRequirement(undefined, {
    clientName: 'Suresh Kumar',
    name: 'Suresh Kumar',
    email: 'suresh@example.com',
    companyName: 'Tech Instruments',
    phone: '9876543210',
    primaryService: 'PLC Programming & Industrial Automation',
    industryDomain: 'Automotive',
    solution: 'PLC Development',
    applicationDescription: 'Automated test line',
    supportType: 'Remote support'
  });

  console.log('Result Success!');
  console.log('Meeting Link Generated:', res.meetingLink);
  console.log('Requirement Status:', res.status);
}

test()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
  });

