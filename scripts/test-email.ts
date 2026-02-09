import 'dotenv/config';
import { sendBookingConfirmationEmail } from '../src/services/emailService';

async function testEmail() {
    const userEmail = process.env.EMAIL_USER;

    if (!userEmail) {
        console.error('❌ Lỗi: Chưa cấu hình EMAIL_USER trong file .env');
        process.exit(1);
    }

    console.log(`📧 Đang thử gửi email test đến: ${userEmail}...`);

    try {
        await sendBookingConfirmationEmail(userEmail, {
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
