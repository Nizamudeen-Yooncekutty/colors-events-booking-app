const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-for-unit-tests';
process.env.JWT_EXPIRES_IN = '1h';

const { generateToken } = require('../middleware/auth');

describe('generateToken', () => {
  test('returns a valid JWT string', () => {
    const token = generateToken('user123');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('contains the user ID in payload', () => {
    const token = generateToken('user123');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe('user123');
  });

  test('uses HS256 algorithm', () => {
    const token = generateToken('user123');
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    expect(header.alg).toBe('HS256');
  });

  test('has expiration', () => {
    const token = generateToken('user123');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
  });

  test('rejects with wrong secret', () => {
    const token = generateToken('user123');
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});

describe('protect middleware', () => {
  const { protect } = require('../middleware/auth');

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('rejects request without Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with non-Bearer token', async () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with invalid JWT', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects oversized token', async () => {
    const req = { headers: { authorization: `Bearer ${'a'.repeat(3000)}` } };
    const res = mockRes();
    const next = jest.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, invalid token' });
  });

  test('rejects expired token', async () => {
    const expiredToken = jwt.sign({ id: 'user1' }, process.env.JWT_SECRET, { expiresIn: '0s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = mockRes();
    const next = jest.fn();

    await new Promise(r => setTimeout(r, 100));
    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Session expired, please login again' });
  });
});

describe('adminOnly middleware', () => {
  const { adminOnly } = require('../middleware/auth');

  test('allows admin role', () => {
    const req = { employee: { role: 'admin' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects employee role', () => {
    const req = { employee: { role: 'employee' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects volunteer role', () => {
    const req = { employee: { role: 'volunteer' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('adminOrVolunteer middleware', () => {
  const { adminOrVolunteer } = require('../middleware/auth');

  test('allows admin', () => {
    const req = { employee: { role: 'admin' } };
    const next = jest.fn();
    adminOrVolunteer(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows volunteer', () => {
    const req = { employee: { role: 'volunteer' } };
    const next = jest.fn();
    adminOrVolunteer(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects employee', () => {
    const req = { employee: { role: 'employee' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    adminOrVolunteer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
