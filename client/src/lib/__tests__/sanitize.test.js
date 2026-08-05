import { describe, it, expect } from 'vitest';
import {
  hasSQLInjection,
  hasXSS,
  sanitizeInput,
  isUnsafeInput,
  sanitizeEmployeeId,
  sanitizeName,
  sanitizePhone,
  sanitizeEmail,
} from '../sanitize';

describe('hasSQLInjection', () => {
  it('detects SELECT statement', () => {
    expect(hasSQLInjection("'; SELECT * FROM users --")).toBe(true);
  });

  it('detects DROP TABLE', () => {
    expect(hasSQLInjection('DROP TABLE employees')).toBe(true);
  });

  it('detects UNION injection', () => {
    expect(hasSQLInjection("1 UNION SELECT password FROM users")).toBe(true);
  });

  it('detects SQL comment markers', () => {
    expect(hasSQLInjection('admin --')).toBe(true);
  });

  it('detects block comment markers', () => {
    expect(hasSQLInjection('/* comment */')).toBe(true);
  });

  it('allows normal text', () => {
    expect(hasSQLInjection('John Doe')).toBe(false);
  });

  it('allows normal sentences', () => {
    expect(hasSQLInjection('Please select your food preference')).toBe(true);
  });

  it('returns false for non-string', () => {
    expect(hasSQLInjection(123)).toBe(false);
    expect(hasSQLInjection(null)).toBe(false);
  });
});

describe('hasXSS', () => {
  it('detects script tags', () => {
    expect(hasXSS('<script>alert("xss")</script>')).toBe(true);
  });

  it('detects script tag with spaces', () => {
    expect(hasXSS('<  script >alert(1)</script>')).toBe(true);
  });

  it('detects event handlers', () => {
    expect(hasXSS('onmouseover=alert(1)')).toBe(true);
    expect(hasXSS('onerror=alert(1)')).toBe(true);
  });

  it('detects javascript: URIs', () => {
    expect(hasXSS('javascript:alert(1)')).toBe(true);
  });

  it('detects iframe injection', () => {
    expect(hasXSS('<iframe src="evil.com"></iframe>')).toBe(true);
  });

  it('detects img injection', () => {
    expect(hasXSS('<img src=x onerror=alert(1)>')).toBe(true);
  });

  it('detects svg injection', () => {
    expect(hasXSS('<svg onload=alert(1)>')).toBe(true);
  });

  it('allows normal text', () => {
    expect(hasXSS('Hello World')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(hasXSS(42)).toBe(false);
    expect(hasXSS(undefined)).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('strips HTML tags', () => {
    expect(sanitizeInput('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('removes angle brackets', () => {
    const result = sanitizeInput('a < b > c');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('returns non-string values unchanged', () => {
    expect(sanitizeInput(42)).toBe(42);
    expect(sanitizeInput(null)).toBe(null);
  });
});

describe('isUnsafeInput', () => {
  it('detects SQL injection', () => {
    expect(isUnsafeInput("'; DROP TABLE users")).toBe(true);
  });

  it('detects XSS', () => {
    expect(isUnsafeInput('<script>alert(1)</script>')).toBe(true);
  });

  it('allows safe input', () => {
    expect(isUnsafeInput('John Doe')).toBe(false);
  });
});

describe('sanitizeEmployeeId', () => {
  it('removes non-alphanumeric characters', () => {
    expect(sanitizeEmployeeId('EMP-001!')).toBe('EMP001');
  });

  it('truncates to 20 characters', () => {
    expect(sanitizeEmployeeId('A'.repeat(30))).toHaveLength(20);
  });

  it('allows valid employee IDs', () => {
    expect(sanitizeEmployeeId('EMP001')).toBe('EMP001');
  });

  it('removes spaces and special chars', () => {
    expect(sanitizeEmployeeId('EMP 001@#$')).toBe('EMP001');
  });
});

describe('sanitizeName', () => {
  it('allows letters, spaces, dots, apostrophes, hyphens', () => {
    expect(sanitizeName("O'Brien-Smith Jr.")).toBe("O'Brien-Smith Jr.");
  });

  it('removes numbers and special characters', () => {
    expect(sanitizeName('John123!@#')).toBe('John');
  });

  it('truncates to 100 characters', () => {
    expect(sanitizeName('A'.repeat(150))).toHaveLength(100);
  });
});

describe('sanitizePhone', () => {
  it('allows digits, plus, hyphen, spaces, parentheses', () => {
    expect(sanitizePhone('+91 (123) 456-7890')).toBe('+91 (123) 456-7890');
  });

  it('removes letters and special chars', () => {
    expect(sanitizePhone('abc123def456')).toBe('123456');
  });

  it('truncates to 20 characters', () => {
    expect(sanitizePhone('1'.repeat(30))).toHaveLength(20);
  });
});

describe('sanitizeEmail', () => {
  it('allows valid email characters', () => {
    expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
  });

  it('allows plus addressing', () => {
    expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
  });

  it('removes invalid characters', () => {
    expect(sanitizeEmail('user!#$@exam ple.com')).toBe('user@example.com');
  });

  it('truncates to 255 characters', () => {
    expect(sanitizeEmail('a'.repeat(300))).toHaveLength(255);
  });
});
