const nodemailer = require('nodemailer');

let transporter = null;
let smtpDisabledLogged = false;

const PLACEHOLDER_VALUES = new Set([
  'your_email@gmail.com',
  'your_app_password',
  'change-me',
  'changeme',
]);

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const getTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  const missingRequired = !smtpHost || !smtpUser || !smtpPass;
  const usesPlaceholder = PLACEHOLDER_VALUES.has(smtpUser) || PLACEHOLDER_VALUES.has(smtpPass);
  if (missingRequired || usesPlaceholder) {
    if (!smtpDisabledLogged) {
      console.warn('Email disabled: SMTP is not configured with real credentials.');
      smtpDisabledLogged = true;
    }
    return null;
  }

  if (!transporter) {
    const secure = smtpPort === 465;
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      requireTLS: !secure,
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 15000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000),
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    });
  }
  return transporter;
};

const sendBookingConfirmation = async (employee, event, booking) => {
  try {
    const mail = getTransporter();
    if (!mail) return;

    const eName = escapeHtml(employee.name);
    const eTitle = escapeHtml(event.title);
    const eVenue = escapeHtml(event.venue);
    const eLocation = escapeHtml(event.location);
    const bFood = escapeHtml(booking.foodPreference);

    await mail.sendMail({
      from: `"UST QPass" <${process.env.SMTP_USER}>`,
      to: employee.email,
      subject: `Booking Confirmed: ${eTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Booking Confirmed!</h2>
          <p>Hi <strong>${eName}</strong>,</p>
          <p>Your booking for <strong>${eTitle}</strong> has been confirmed.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Event:</strong> ${eTitle}</p>
            <p><strong>Date:</strong> ${new Date(event.eventDate).toLocaleDateString()}</p>
            <p><strong>Venue:</strong> ${eVenue}</p>
            ${event.location ? `<p><strong>Location:</strong> ${eLocation}</p>` : ''}
            <p><strong>Food Preference:</strong> ${bFood}</p>
          </div>
          <p>Your digital QR pass is available in the app. Show it at the venue for entry.</p>
          <p style="color: #6b7280; font-size: 12px;">This is an automated email from UST QPass.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Email send failed:', error.message);
  }
};

module.exports = { sendBookingConfirmation };
