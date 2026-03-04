import nodemailer from 'nodemailer';
import 'dotenv/config';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

/* ============================= */
/*            CONFIG             */
/* ============================= */

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 465;
const SMTP_SECURE = true;

const EMAIL_FROM_NAME = 'Nhà hàng Le68';
const EMAIL_SUBJECT = 'Xác nhận Đặt bàn tại Nhà hàng Le68';
const ADMIN_BOOKING_SUBJECT = '[Le68] Có đơn đặt bàn mới';
const TIMEZONE_OFFSET = '+07:00';

/* ============================= */
/*         TRANSPORTER           */
/* ============================= */

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const verifyMailerConnection = async (): Promise<void> => {
  try {
    await transporter.verify();
    console.log('[MAILER_READY]');
  } catch (error: any) {
    console.error('[MAILER_INIT_ERROR]', error.message);
    process.exit(1);
  }
};

/* ============================= */
/*            TYPES              */
/* ============================= */

export interface BookingDetails {
  userName: string;
  booking_date: string; // yyyy-mm-dd
  time: string;         // HH:mm
  number_of_guest: number;
  message?: string;
}

export interface AdminBookingNotificationDetails extends BookingDetails {
  userEmail: string;
  userPhoneNumber?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
}

/* ============================= */
/*         VALIDATION            */
/* ============================= */

const validateInput = (
  userEmail: string,
  details: BookingDetails
): void => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials are missing.');
  }

  if (!userEmail || !/^\S+@\S+\.\S+$/.test(userEmail)) {
    throw new Error('Invalid user email.');
  }

  if (!details.booking_date || !details.time) {
    throw new Error('Booking date and time are required.');
  }

  if (!details.number_of_guest || details.number_of_guest <= 0) {
    throw new Error('Invalid number of guests.');
  }
};

/* ============================= */
/*        DATE HANDLING          */
/* ============================= */

const extractTimeHHmm = (rawTime: string): string => {
  const t = (rawTime || '').trim();

  // Case 1: already "HH:mm" or "HH:mm:ss"
  const hhmm = t.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;

  // Case 2: "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm" (optional seconds)
  const datetime = t.match(
    /^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );
  if (datetime) return `${datetime[1]}:${datetime[2]}`;

  throw new Error(`Invalid time format: "${rawTime}"`);
};

const buildBookingDateTime = (date: string, time: string): Date => {
  const safeDate = (date || '').trim(); // expect YYYY-MM-DD
  const safeTimeHHmm = extractTimeHHmm(time);

  const isoString = `${safeDate}T${safeTimeHHmm}:00${TIMEZONE_OFFSET}`;

  console.log('[BOOKING_DATETIME_INPUT]', { date: safeDate, time, normalizedTime: safeTimeHHmm });
  console.log('[BOOKING_DATETIME_ISO]', isoString);

  const bookingDateTime = new Date(isoString);

  if (Number.isNaN(bookingDateTime.getTime())) {
    throw new Error(`Invalid booking datetime built from "${isoString}"`);
  }

  return bookingDateTime;
};

/* ============================= */
/*        HTML UTILITIES         */
/* ============================= */

const escapeHtml = (text?: string): string => {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/* ============================= */
/*        EMAIL BUILDER          */
/* ============================= */

const buildEmailHtml = ({
                          userName,
                          friendlyDate,
                          friendlyTime,
                          numberOfGuest,
                          message,
                        }: {
  userName: string;
  friendlyDate: string;
  friendlyTime: string;
  numberOfGuest: number;
  message?: string;
}): string => {
  return `
    <h1>Xác nhận Đặt bàn Thành công!</h1>
    <p>Chào ${escapeHtml(userName)},</p>
    <p>Cảm ơn bạn đã đặt bàn tại nhà hàng của chúng tôi. Dưới đây là thông tin chi tiết:</p>
    <ul>
      <li><strong>Ngày đặt:</strong> ${friendlyDate}</li>
      <li><strong>Giờ đặt:</strong> ${friendlyTime}</li>
      <li><strong>Số lượng khách:</strong> ${numberOfGuest}</li>
      ${
    message
      ? `<li><strong>Ghi chú:</strong> ${escapeHtml(message)}</li>`
      : ''
  }
    </ul>
    <p>Chúng tôi rất mong được phục vụ bạn.</p>
    <p>Trân trọng,<br>${EMAIL_FROM_NAME}</p>
  `;
};

const buildMailOptions = (
  userEmail: string,
  htmlContent: string
) => {
  return {
    from: `"${EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: EMAIL_SUBJECT,
    html: htmlContent,
  };
};

const buildAdminBookingNotificationHtml = ({
  userName,
  userEmail,
  userPhoneNumber,
  friendlyDate,
  friendlyTime,
  numberOfGuest,
  message,
}: {
  userName: string;
  userEmail: string;
  userPhoneNumber?: string;
  friendlyDate: string;
  friendlyTime: string;
  numberOfGuest: number;
  message?: string;
}): string => {
  return `
    <h1>Có đơn đặt bàn mới</h1>
    <p><strong>Khách hàng:</strong> ${escapeHtml(userName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
    <p><strong>Số điện thoại:</strong> ${escapeHtml(userPhoneNumber || '-')}</p>
    <ul>
      <li><strong>Ngày đặt:</strong> ${friendlyDate}</li>
      <li><strong>Giờ đặt:</strong> ${friendlyTime}</li>
      <li><strong>Số lượng khách:</strong> ${numberOfGuest}</li>
      ${
    message
      ? `<li><strong>Ghi chú:</strong> ${escapeHtml(message)}</li>`
      : ''
  }
    </ul>
  `;
};

/* ============================= */
/*        MAIN FUNCTION          */
/* ============================= */

export const sendBookingConfirmationEmail = async (
  userEmail: string,
  details: BookingDetails
): Promise<SendEmailResult> => {
  try {
    validateInput(userEmail, details);

    const bookingDateTime = buildBookingDateTime(
      details.booking_date,
      details.time
    );

    const friendlyDate = format(
      bookingDateTime,
      'dd/MM/yyyy',
      { locale: vi }
    );

    const friendlyTime = format(
      bookingDateTime,
      'HH:mm',
      { locale: vi }
    );

    const htmlContent = buildEmailHtml({
      userName: details.userName,
      friendlyDate,
      friendlyTime,
      numberOfGuest: details.number_of_guest,
      message: details.message,
    });

    const mailOptions = buildMailOptions(userEmail, htmlContent);

    const info = await transporter.sendMail(mailOptions);

    console.log('[BOOKING_EMAIL_SENT]', {
      email: userEmail,
      guests: details.number_of_guest,
      date: friendlyDate,
      time: friendlyTime,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('[BOOKING_EMAIL_ERROR]', {
      email: userEmail,
      error: error.message,
    });

    throw new Error('Không thể gửi email xác nhận.');
  }
};

export const sendNewBookingNotificationToAdmin = async (
  details: AdminBookingNotificationDetails
): Promise<SendEmailResult> => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email credentials are missing.');
    }

    const adminEmail = process.env.EMAIL_USER;
    const bookingDateTime = buildBookingDateTime(
      details.booking_date,
      details.time
    );

    const friendlyDate = format(
      bookingDateTime,
      'dd/MM/yyyy',
      { locale: vi }
    );

    const friendlyTime = format(
      bookingDateTime,
      'HH:mm',
      { locale: vi }
    );

    const htmlContent = buildAdminBookingNotificationHtml({
      userName: details.userName,
      userEmail: details.userEmail,
      userPhoneNumber: details.userPhoneNumber,
      friendlyDate,
      friendlyTime,
      numberOfGuest: details.number_of_guest,
      message: details.message,
    });

    const info = await transporter.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: ADMIN_BOOKING_SUBJECT,
      html: htmlContent,
    });

    console.log('[ADMIN_BOOKING_EMAIL_SENT]', {
      to: adminEmail,
      customerEmail: details.userEmail,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('[ADMIN_BOOKING_EMAIL_ERROR]', {
      customerEmail: details.userEmail,
      error: error.message,
    });

    throw new Error('Không thể gửi email thông báo cho admin.');
  }
};
