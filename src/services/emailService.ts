import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface BookingDetails {
  userName: string;
  time: string;
  booking_date: string;
  number_of_guest: string;
  message?: string;
}

export const sendBookingConfirmationEmail = async (userEmail: string, details: BookingDetails) => {
  const { userName, booking_date, time, number_of_guest, message } = details;

  // Định dạng lại ngày giờ cho thân thiện hơn
  const friendlyDate = new Date(booking_date).toLocaleDateString('vi-VN');
  const friendlyTime = new Date(time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const htmlContent = `
    <h1>Xác nhận Đặt bàn Thành công!</h1>
    <p>Chào ${userName},</p>
    <p>Cảm ơn bạn đã đặt bàn tại nhà hàng của chúng tôi. Dưới đây là thông tin chi tiết:</p>
    <ul>
      <li><strong>Ngày đặt:</strong> ${friendlyDate}</li>
      <li><strong>Giờ đặt:</strong> ${friendlyTime}</li>
      <li><strong>Số lượng khách:</strong> ${number_of_guest}</li>
      ${message ? `<li><strong>Ghi chú:</strong> ${message}</li>` : ''}
    </ul>
    <p>Chúng tôi rất mong được phục vụ bạn.</p>
    <p>Trân trọng,<br>Nhà hàng ABC</p>
  `;

  // Các tùy chọn cho email
  const mailOptions = {
    from: `"Nhà hàng ABC" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Xác nhận Đặt bàn tại Nhà hàng ABC',
    html: htmlContent, 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email đã được gửi thành công: %s', info.messageId);
  } catch (error) {
    console.error('Lỗi khi gửi email:', error);
    throw new Error('Không thể gửi email xác nhận.');
  }
};