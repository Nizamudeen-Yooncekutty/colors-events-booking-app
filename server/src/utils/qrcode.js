const QRCode = require('qrcode');
const crypto = require('crypto');

const generateQRData = (bookingId, employeeId, eventId) => {
  const payload = `${bookingId}:${employeeId}:${eventId}:${Date.now()}`;
  const hash = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 12);
  return `COLORS-${hash}-${bookingId}`;
};

const generateQRImage = async (qrData) => {
  const qrImage = await QRCode.toDataURL(qrData, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
  return qrImage;
};

module.exports = { generateQRData, generateQRImage };
