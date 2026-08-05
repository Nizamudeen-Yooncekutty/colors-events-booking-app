const { sanitizeInputs } = require('../middleware/sanitize');
const { requestId } = require('../middleware/requestId');

describe('sanitizeInputs middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test('allows safe request body', () => {
    const req = { body: { name: 'John', email: 'john@test.com' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects SQL injection in body', () => {
    const req = { body: { name: "'; DROP TABLE users" }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects NoSQL injection in body', () => {
    const req = { body: { password: { $ne: '' } }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects command injection', () => {
    const req = { body: { input: 'ls && rm -rf /' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejects path traversal', () => {
    const req = { body: { file: '../../../etc/passwd' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('sanitizes script tags from strings', () => {
    const req = { body: { name: '<script>alert(1)</script>John' }, query: {} };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body.name).not.toContain('<script>');
  });

  test('trims query params', () => {
    const req = { body: {}, query: { search: '  hello  ' } };
    const res = mockRes();
    const next = jest.fn();

    sanitizeInputs(req, res, next);
    expect(req.query.search).toBe('hello');
  });
});

describe('requestId middleware', () => {
  test('generates UUID when no X-Request-ID header', () => {
    const req = { headers: {} };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  test('uses valid X-Request-ID from header', () => {
    const req = { headers: { 'x-request-id': 'my-custom-id-123' } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toBe('my-custom-id-123');
  });

  test('rejects invalid X-Request-ID and generates new one', () => {
    const req = { headers: { 'x-request-id': '<script>alert(1)</script>' } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).not.toContain('<script>');
    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('rejects oversized X-Request-ID', () => {
    const req = { headers: { 'x-request-id': 'a'.repeat(200) } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
