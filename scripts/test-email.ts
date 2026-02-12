import 'dotenv/config';
import { sendBookingConfirmationEmail } from '../src/services/emailService';

async function testEmail() {
    const userEmail = process.env.EMAIL_USER;
    // Lấy email người nhận từ tham số dòng lệnh (nếu có), nếu không thì gửi cho chính mình
    const recipientEmail = process.argv[2] || userEmail;

    if (!userEmail) {
        console.error('❌ Lỗi: Chưa cấu hình EMAIL_USER trong file .env');
        process.exit(1);
    }

    if (!recipientEmail) {
        console.error('❌ Lỗi: Không xác định được người nhận. Vui lòng kiểm tra lại cấu hình hoặc tham số.');
        process.exit(1);
    }

    console.log(`📧 Đang thử gửi email test đến: ${recipientEmail}...`);

    try {
        await sendBookingConfirmationEmail(recipientEmail, {
          userName: 'Test User',
          time: '19:00',
          booking_date: new Date().toISOString(),
          number_of_guest: '2',
          message: 'Đây là email kiểm tra hệ thống.',
        });
        console.log('✅ Gửi email thành công! Hãy kiểm tra hộp thư đến của bạn.');
    } catch (error) {
        console.error('❌ Gửi email thất bại:', error);
    }
}

testEmail();
