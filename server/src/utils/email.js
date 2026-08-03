const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const sendBookingConfirmation = async (employee, event, booking) => {
  try {
    const mail = getTransporter();
    await mail.sendMail({
      from: `"UST PassMint" <${process.env.SMTP_USER}>`,
      to: employee.email,
      subject: `Booking Confirmed: ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Booking Confirmed!</h2>
          <p>Hi <strong>${employee.name}</strong>,</p>
          <p>Your booking for <strong>${event.title}</strong> has been confirmed.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Event:</strong> ${event.title}</p>
            <p><strong>Date:</strong> ${new Date(event.eventDate).toLocaleDateString()}</p>
            <p><strong>Venue:</strong> ${event.venue}</p>
            <p><strong>Food Preference:</strong> ${booking.foodPreference}</p>
          </div>
          <p>Your digital QR pass is available in the app. Show it at the venue for entry.</p>
          <p style="color: #6b7280; font-size: 12px;">This is an automated email from UST PassMint.</p>
        </div>
      `,
    });
    console.log(`Confirmation email sent to ${employee.email}`);
  } catch (error) {
    console.error('Email send failed:', error.message);
    // Don't throw - email failure shouldn't block booking
  }
};

module.exports = { sendBookingConfirmation };
