import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

jest.setTimeout(30000);

jest.mock('../services/storage.service', () => {
  return {
    storageService: {
      uploadFile: jest.fn().mockResolvedValue('requirements/mock/path/file.pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    }
  };
});

describe('File Upload Tests', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let reqA1: any;
  let reqB1: any;

  beforeAll(async () => {
    await prisma.requirement.deleteMany({});
    
    // Register User A
    const emailA = `testA_${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email: emailA, password: 'Password123!', confirmPassword: 'Password123!' });
    
    // Login User A
    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: emailA, password: 'Password123!' });
    
    userA = loginA.body.user;
    const cookiesA = loginA.headers['set-cookie'] as unknown as string[];
    tokenA = cookiesA?.find((c: string) => c.startsWith('access_token'))?.split(';')[0].split('=')[1] || '';

    // Register User B
    const emailB = `testB_${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email: emailB, password: 'Password123!', confirmPassword: 'Password123!' });
    
    // Login User B
    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: emailB, password: 'Password123!' });
    
    userB = loginB.body.user;
    const cookiesB = loginB.headers['set-cookie'] as unknown as string[];
    tokenB = cookiesB?.find((c: string) => c.startsWith('access_token'))?.split(';')[0].split('=')[1] || '';


    // Create Requirement for User A
    const resReqA = await request(app)
      .post('/api/requirements')
      .set('Cookie', [`access_token=${tokenA}`])
      .send({ industryDomain: 'Aerospace', projectType: 'Test', targetTimeline: 'Immediate', applicationDescription: 'A1 test description', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
    reqA1 = resReqA.body.data.requirement;

    // Create Requirement for User B
    const resReqB = await request(app)
      .post('/api/requirements')
      .set('Cookie', [`access_token=${tokenB}`])
      .send({ industryDomain: 'Defense', projectType: 'Test', targetTimeline: 'Immediate', applicationDescription: 'B1 test description', supportType: 'ONLINE', country: 'India', phoneCountryCode: '+91', phoneNumber: '9876543210' });
    reqB1 = resReqB.body.data.requirement;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('User A should be able to upload a valid document to their own requirement', async () => {
    const res = await request(app)
      .post(`/api/requirements/${reqA1.id}/documents`)
      .set('Cookie', [`access_token=${tokenA}`])
      .attach('document', Buffer.from('mock pdf content', 'utf8'), 'test.pdf');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requirement.documents).toContain('requirements/mock/path/file.pdf');
  });

  it('Should return 400 for unsupported file type', async () => {
    const res = await request(app)
      .post(`/api/requirements/${reqA1.id}/documents`)
      .set('Cookie', [`access_token=${tokenA}`])
      .attach('document', Buffer.from('console.log("hello")', 'utf8'), 'test.js');
    
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Unsupported file type/);
  });

  it('User B cannot upload to User A requirement (IDOR)', async () => {
    const res = await request(app)
      .post(`/api/requirements/${reqA1.id}/documents`)
      .set('Cookie', [`access_token=${tokenB}`])
      .attach('document', Buffer.from('hello', 'utf8'), 'test.pdf');
    
    // AuthError throws 403
    expect(res.statusCode).toBe(403);
  });
});
