const QRCode = require('qrcode');
const crypto = require('crypto');

const SLOT_COLORS = [
  { dark: '#1a1a2e', light: '#f0f0f8' },
  { dark: '#6A1B9A', light: '#F3E5F5' },
  { dark: '#1565C0', light: '#E3F2FD' },
  { dark: '#2E7D32', light: '#E8F5E9' },
  { dark: '#E65100', light: '#FFF3E0' },
  { dark: '#C62828', light: '#FFEBEE' },
];

const WALKIN_TYPE_COLORS = {
  guest: { dark: '#1565C0', light: '#E3F2FD' },
  staff: { dark: '#F57F17', light: '#FFF8E1' },
  housekeeping: { dark: '#6A1B9A', light: '#F3E5F5' },
  unregistered_employee: { dark: '#E65100', light: '#FFF3E0' },
};

const getSlotColor = (slotIndex) => {
  if (slotIndex == null || slotIndex < 0) return SLOT_COLORS[0];
  return SLOT_COLORS[(slotIndex % (SLOT_COLORS.length - 1)) + 1];
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
  return `WALKIN:${attendeeType}:${eventId}`;
};

const isWalkInQR = (qrData) => {
  return qrData && qrData.startsWith('WALKIN:');
};

const parseWalkInQR = (qrData) => {
  const parts = qrData.split(':');
  if (parts.length !== 3 || parts[0] !== 'WALKIN') return null;
  return { attendeeType: parts[1], eventId: parts[2] };
};

const generateQRImage = async (qrData, slotIndex) => {
  const color = slotIndex != null ? getSlotColor(slotIndex) : SLOT_COLORS[0];
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
  const color = WALKIN_TYPE_COLORS[attendeeType] || SLOT_COLORS[0];
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
  generateQRData, generateQRImage, getSlotColor, SLOT_COLORS,
  generateWalkInQRData, generateWalkInQRImage, isWalkInQR, parseWalkInQR,
  WALKIN_TYPE_COLORS,
};
