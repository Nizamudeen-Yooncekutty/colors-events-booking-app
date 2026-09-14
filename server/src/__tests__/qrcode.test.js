process.env.JWT_SECRET = 'test-secret-for-unit-tests';

const {
  generateQRData,
  generateQRImage,
  getSlotColor,
  generateWalkInQRData,
  isWalkInQR,
  parseWalkInQR,
  WALKIN_TYPE_COLORS,
} = require('../utils/qrcode');

describe('generateQRData', () => {
  test('returns string starting with COLORS-', () => {
    const data = generateQRData('booking1', 'EMP001', 'event1');
    expect(data).toMatch(/^COLORS-[a-f0-9]{12}-booking1$/);
  });

  test('generates unique data for different inputs', () => {
    const data1 = generateQRData('b1', 'EMP001', 'e1');
    const data2 = generateQRData('b2', 'EMP001', 'e1');
    expect(data1).not.toBe(data2);
  });
});

describe('generateQRImage', () => {
  test('returns base64 data URL', async () => {
    const image = await generateQRImage('TEST-DATA');
    expect(image).toMatch(/^data:image\/png;base64,/);
  });

  test('generates image with slot color', async () => {
    const image = await generateQRImage('TEST-DATA', 0);
    expect(image).toMatch(/^data:image\/png;base64,/);
  });
});

describe('getSlotColor', () => {
  test('returns default color for null index', () => {
    const color = getSlotColor(null);
    expect(color.dark).toBe('#1a1a2e');
  });

  test('returns default color for negative index', () => {
    const color = getSlotColor(-1);
    expect(color.dark).toBe('#1a1a2e');
  });

  test('returns color with dark and light for valid index', () => {
    const color = getSlotColor(0);
    expect(color.dark).toBeDefined();
    expect(color.light).toBeDefined();
  });

  test('wraps around for large indices', () => {
    const color = getSlotColor(100);
    expect(color.dark).toBeDefined();
  });
});

describe('generateWalkInQRData', () => {
  test('returns WALKIN: format with HMAC signature', () => {
    const data = generateWalkInQRData('event123', 'guest');
    expect(data).toMatch(/^WALKIN:guest:event123:[a-f0-9]{16}$/);
  });

  test('includes attendee type', () => {
    expect(generateWalkInQRData('e1', 'staff')).toContain('staff');
    expect(generateWalkInQRData('e1', 'housekeeping')).toContain('housekeeping');
  });

  test('generates consistent signature for same inputs', () => {
    const data1 = generateWalkInQRData('event1', 'guest');
    const data2 = generateWalkInQRData('event1', 'guest');
    expect(data1).toBe(data2);
  });
});

describe('isWalkInQR', () => {
  test('detects walk-in QR', () => {
    expect(isWalkInQR('WALKIN:guest:event1')).toBe(true);
  });

  test('rejects employee QR', () => {
    expect(isWalkInQR('COLORS-abc123-booking1')).toBe(false);
  });

  test('rejects null/undefined', () => {
    expect(isWalkInQR(null)).toBeFalsy();
    expect(isWalkInQR(undefined)).toBeFalsy();
  });
});

describe('parseWalkInQR', () => {
  test('parses valid signed walk-in QR', () => {
    const qrData = generateWalkInQRData('event123', 'guest');
    const result = parseWalkInQR(qrData);
    expect(result).toEqual({ attendeeType: 'guest', eventId: 'event123' });
  });

  test('returns null for unsigned QR (forged)', () => {
    expect(parseWalkInQR('WALKIN:guest:event123')).toBeNull();
  });

  test('returns null for invalid signature', () => {
    expect(parseWalkInQR('WALKIN:guest:event123:invalidsig00000')).toBeNull();
  });

  test('returns null for invalid format', () => {
    expect(parseWalkInQR('INVALID')).toBeNull();
    expect(parseWalkInQR('WALKIN:only-two')).toBeNull();
  });

  test('returns null for non-WALKIN prefix', () => {
    expect(parseWalkInQR('COLORS:guest:event1:abcd1234abcd1234')).toBeNull();
  });
});

describe('WALKIN_TYPE_COLORS', () => {
  test('has colors for all attendee types', () => {
    expect(WALKIN_TYPE_COLORS.guest).toBeDefined();
    expect(WALKIN_TYPE_COLORS.staff).toBeDefined();
    expect(WALKIN_TYPE_COLORS.housekeeping).toBeDefined();
    expect(WALKIN_TYPE_COLORS.unregistered_employee).toBeDefined();
  });

  test('each color has dark and light', () => {
    Object.values(WALKIN_TYPE_COLORS).forEach(color => {
      expect(color.dark).toBeDefined();
      expect(color.light).toBeDefined();
    });
  });
});
