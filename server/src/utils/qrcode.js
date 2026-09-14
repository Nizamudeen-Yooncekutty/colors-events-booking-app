const QRCode = require('qrcode');
const crypto = require('crypto');

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateSlotColor(slotIndex, totalSlots) {
  const goldenAngle = 137.508;
  const hue = (slotIndex * goldenAngle) % 360;
  const dark = hslToHex(hue, 70, 35);
  const light = hslToHex(hue, 50, 95);
  return { dark, light };
}

const DEFAULT_COLOR = { dark: '#1a1a2e', light: '#f0f0f8' };

const WALKIN_TYPE_COLORS = {
  guest: { dark: '#1565C0', light: '#E3F2FD' },
  staff: { dark: '#F57F17', light: '#FFF8E1' },
  housekeeping: { dark: '#6A1B9A', light: '#F3E5F5' },
  unregistered_employee: { dark: '#E65100', light: '#FFF3E0' },
};

const getSlotColor = (slotIndex, totalSlots) => {
  if (slotIndex == null || slotIndex < 0) return DEFAULT_COLOR;
  return generateSlotColor(slotIndex, totalSlots || 5);
};

const generateQRData = (bookingId, employeeId, eventId) => {
  const payload = `${bookingId}:${employeeId}:${eventId}:${Date.now()}`;
  const hash = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 12);
  return `COLORS-${hash}-${bookingId}`;
};

const generateWalkInQRData = (eventId, attendeeType) => {
  const data = `WALKIN:${attendeeType}:${eventId}`;
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16);
  return `${data}:${sig}`;
};

const isWalkInQR = (qrData) => {
  return qrData && qrData.startsWith('WALKIN:');
};

const parseWalkInQR = (qrData) => {
  const parts = qrData.split(':');
  if (parts.length !== 4 || parts[0] !== 'WALKIN') return null;

  const data = `WALKIN:${parts[1]}:${parts[2]}`;
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16);

  if (parts[3] !== expectedSig) return null;

  return { attendeeType: parts[1], eventId: parts[2] };
};

const generateQRImage = async (qrData, slotIndex, totalSlots) => {
  const color = slotIndex != null ? getSlotColor(slotIndex, totalSlots) : DEFAULT_COLOR;
  const qrImage = await QRCode.toDataURL(qrData, {
    width: 400,
    margin: 2,
    color: {
      dark: color.dark,
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
  return qrImage;
};

const generateWalkInQRImage = async (qrData, attendeeType) => {
  const color = WALKIN_TYPE_COLORS[attendeeType] || DEFAULT_COLOR;
  const qrImage = await QRCode.toDataURL(qrData, {
    width: 400,
    margin: 2,
    color: {
      dark: color.dark,
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
  return qrImage;
};

module.exports = {
  generateQRData, generateQRImage, getSlotColor, generateSlotColor,
  generateWalkInQRData, generateWalkInQRImage, isWalkInQR, parseWalkInQR,
  WALKIN_TYPE_COLORS,
};
