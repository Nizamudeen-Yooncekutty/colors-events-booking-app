const {
  sanitizeString,
  sanitizeObject,
  runSecurityChecks,
  hasNoSQLInjection,
} = require('../utils/sanitizer');

describe('hasNoSQLInjection', () => {
  test('detects $where operator', () => {
    expect(hasNoSQLInjection({ $where: 'this.a > 1' })).toBe(true);
  });
  test('detects $ne operator', () => {
    expect(hasNoSQLInjection({ password: { $ne: '' } })).toBe(true);
  });
  test('detects $gt operator', () => {
    expect(hasNoSQLInjection({ age: { $gt: 0 } })).toBe(true);
  });
  test('detects $regex operator', () => {
    expect(hasNoSQLInjection({ name: { $regex: '.*' } })).toBe(true);
  });
  test('detects nested operator', () => {
    expect(hasNoSQLInjection({ user: { password: { $ne: '' } } })).toBe(true);
  });
  test('allows normal object', () => {
    expect(hasNoSQLInjection({ name: 'John', email: 'john@test.com' })).toBe(false);
  });
  test('returns false for non-object', () => {
    expect(hasNoSQLInjection('string')).toBe(false);
    expect(hasNoSQLInjection(null)).toBe(false);
  });
});

describe('sanitizeString', () => {
  test('strips XSS from string', () => {
    const result = sanitizeString('<script>alert(1)</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });
  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });
  test('returns non-string unchanged', () => {
    expect(sanitizeString(42)).toBe(42);
    expect(sanitizeString(null)).toBe(null);
  });
});

describe('sanitizeObject', () => {
  test('sanitizes nested strings', () => {
    const result = sanitizeObject({
      name: '<script>alert(1)</script>John',
      nested: { value: '<script>x</script>safe' },
    });
    expect(result.name).not.toContain('<script>');
    expect(result.nested.value).not.toContain('<script>');
  });
  test('handles arrays', () => {
    const result = sanitizeObject(['<script>a</script>x', '<script>b</script>y']);
    expect(result[0]).not.toContain('<script>');
    expect(result[1]).not.toContain('<script>');
  });
  test('returns non-object unchanged', () => {
    expect(sanitizeObject(42)).toBe(42);
    expect(sanitizeObject(null)).toBe(null);
  });
});

describe('runSecurityChecks', () => {
  test('allows normal sentences with SQL-like words', () => {
    expect(runSecurityChecks('Please select your food preference')).toBeNull();
  });
  test('detects NoSQL injection in object', () => {
    expect(runSecurityChecks({ password: { $ne: '' } })).toBeTruthy();
  });
  test('detects command injection', () => {
    expect(runSecurityChecks('ls && rm -rf /')).toBeTruthy();
  });
  test('detects path traversal', () => {
    expect(runSecurityChecks('../../../etc/passwd')).toBeTruthy();
  });
  test('detects null bytes', () => {
    expect(runSecurityChecks('file\x00.txt')).toBeTruthy();
  });
  test('detects nested NoSQL threats', () => {
    expect(runSecurityChecks({ data: { $ne: '' } })).toBeTruthy();
  });
  test('allows safe data', () => {
    expect(runSecurityChecks({ name: 'John', email: 'john@test.com' })).toBeNull();
  });
  test('allows safe string', () => {
    expect(runSecurityChecks('Hello World')).toBeNull();
  });
});
