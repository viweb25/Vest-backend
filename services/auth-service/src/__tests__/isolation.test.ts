import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';

jest.setTimeout(30000);

describe('Multi-User Isolation', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    // Clear out test DB just in case (if this were a real test DB)
    await prisma.requirement.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({});

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ email: 'usera@example.com', password: 'Password123!', confirmPassword: 'Password123!' });
    
    // Login User A
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'usera@example.com', password: 'Password123!' });
    
    userA = loginA.body.user;
    const cookiesA = loginA.headers['set-cookie'] as unknown as string[];
    tokenA = cookiesA?.find((c: string) => c.startsWith('access_token'))?.split(';')[0].split('=')[1] || '';

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ email: 'userb@example.com', password: 'Password123!', confirmPassword: 'Password123!' });
    
    // Login User B
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'userb@example.com', password: 'Password123!' });
    
    userB = loginB.body.user;
    const cookiesB = loginB.headers['set-cookie'] as unknown as string[];
    tokenB = cookiesB?.find((c: string) => c.startsWith('access_token'))?.split(';')[0].split('=')[1] || '';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Account & Profile Isolation', () => {
    it('User A and User B should have different IDs', () => {
      expect(userA.id).toBeDefined();
      expect(userB.id).toBeDefined();
      expect(userA.id).not.toBe(userB.id);
    });

    it('User A creates profile, User B profile remains unchanged', async () => {
      // User A creates/updates profile
      await request(app)
        .put('/api/profile/me')
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ companyName: 'Company A' });
      
      // User B creates/updates profile
      await request(app)
        .put('/api/profile/me')
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ companyName: 'Company B' });

      // Verify Profile A
      const resProfileA = await request(app).get('/api/profile/me').set('Cookie', [`access_token=${tokenA}`]);
      expect(resProfileA.body.data.profile.companyName).toBe('Company A');

      // Verify Profile B
      const resProfileB = await request(app).get('/api/profile/me').set('Cookie', [`access_token=${tokenB}`]);
      expect(resProfileB.body.data.profile.companyName).toBe('Company B');
    });

    it('User B cannot modify User A profile by sending userId in body', async () => {
      // User B attempts to change User A's profile
      await request(app)
        .put('/api/profile/me')
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ userId: userA.id, companyName: 'Hacked Company' });

      // Check User A's profile is intact
      const resProfileA = await request(app).get('/api/profile/me').set('Cookie', [`access_token=${tokenA}`]);
      expect(resProfileA.body.data.profile.companyName).toBe('Company A');

      // Check User B's profile was updated instead
      const resProfileB = await request(app).get('/api/profile/me').set('Cookie', [`access_token=${tokenB}`]);
      expect(resProfileB.body.data.profile.companyName).toBe('Hacked Company');
    });
  });

  describe('Requirement Isolation', () => {
    let reqA1: any;
    let reqB1: any;

    it('User A creates Requirement A1, User B creates Requirement B1', async () => {
      const resReqA = await request(app)
        .post('/api/requirements')
        .set('Cookie', [`access_token=${tokenA}`])
        .send({ industryDomain: 'Aerospace', projectType: 'Test', applicationDescription: 'A1 requirement description', targetTimeline: 'Immediate', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
      
      reqA1 = resReqA.body.data.requirement;
      expect(reqA1.userId).toBe(userA.id);

      const resReqB = await request(app)
        .post('/api/requirements')
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ industryDomain: 'Defense', projectType: 'Test', applicationDescription: 'B1 requirement description', targetTimeline: '3 months', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
      
      reqB1 = resReqB.body.data.requirement;
      expect(reqB1.userId).toBe(userB.id);
    });

    it('User A GET /requirements should only return A1', async () => {
      const res = await request(app).get('/api/requirements').set('Cookie', [`access_token=${tokenA}`]);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(reqA1.id);
    });

    it('User B GET /requirements should only return B1', async () => {
      const res = await request(app).get('/api/requirements').set('Cookie', [`access_token=${tokenB}`]);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(reqB1.id);
    });

    it('User B cannot GET User A requirement directly (IDOR)', async () => {
      const res = await request(app).get(`/api/requirements/${reqA1.id}`).set('Cookie', [`access_token=${tokenB}`]);
      expect(res.statusCode).toBe(403);
    });

    it('User B cannot PUT User A requirement directly (IDOR)', async () => {
      const res = await request(app)
        .put(`/api/requirements/${reqA1.id}`)
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ applicationDescription: 'Hacked desc' });
      expect(res.statusCode).toBe(403);
    });

    it('User B submitting with userId=User A still creates requirement for User B', async () => {
      const res = await request(app)
        .post('/api/requirements')
        .set('Cookie', [`access_token=${tokenB}`])
        .send({ userId: userA.id, industryDomain: 'Telecom', projectType: 'Test', applicationDescription: 'B2 requirement description', targetTimeline: '1 year', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
      
      const newReq = res.body.data.requirement;
      expect(newReq.userId).toBe(userB.id); // Must remain user B
      expect(newReq.userId).not.toBe(userA.id);
    });
  });

  describe('Pagination', () => {
    it('Should paginate requirements for User A', async () => {
      // Create 5 more requirements for User A
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/requirements')
          .set('Cookie', [`access_token=${tokenA}`])
          .send({ industryDomain: 'Auto', projectType: 'Test', applicationDescription: `Req ${i} description`, targetTimeline: 'Immediate', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
      }

      // Total should be 6
      const res = await request(app).get('/api/requirements?page=1&limit=2').set('Cookie', [`access_token=${tokenA}`]);
      
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(6);
      expect(res.body.meta.totalPages).toBe(3);
      expect(res.body.meta.page).toBe(1);
    });
  });
});
