import request from 'supertest';
import app from '../app';
import { prisma } from '../lib/prisma';

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    // Basic setup if needed
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should reject login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });
    
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'not-matching'
      });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('health endpoint should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
