import { Request, Response } from 'express';
import db from '../config/db.config';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { sendBookingConfirmationEmail } from '../services/emailService';

// ✅ Interface: Body của request giờ sẽ chứa thông tin cho cả user và diner
interface CreateDinerAndUserBody {
  // Thông tin user
  userName: string;
  userEmail: string;
  userPhoneNumber?: string;

  // Thông tin diner
  time: string;
  booking_date: string;
  number_of_guest: string;
  message?: string;
  body?: string;
}

// Interface DinerWithUser vẫn giữ nguyên
interface DinerWithUser extends RowDataPacket {
  id: number;
  booking_date: string;
  time: string;
  number_of_guest: string;
  status: string;
  user_name: string;
  user_email: string;
}

class DinerController {
  // ✅ Viết lại logic hàm để xử lý việc tạo cả hai bản ghi
  public async createDinerFromUser(req: Request<{}, {}, CreateDinerAndUserBody>, res: Response): Promise<Response> {
    let connection: PoolConnection | undefined;

    try {
      const {
        userName, userEmail, userPhoneNumber,
        time, booking_date, number_of_guest, message, body
      } = req.body;

      if (!userName || !userEmail || !time || !booking_date || !number_of_guest) {
        return res.status(400).json({ message: 'Vui lòng điền đủ các trường bắt buộc.' });
      }

      connection = await db.getConnection();
      await connection.beginTransaction();

      const userSql = 'INSERT INTO users (username, email, phone_number) VALUES (?, ?, ?)';
      const userValues = [userName, userEmail, userPhoneNumber || null];
      const [userResult] = await connection.query<ResultSetHeader>(userSql, userValues);
      const newUserId = userResult.insertId;

      const dinerSql = 'INSERT INTO diners (time, booking_date, number_of_guest, user_id, message, body, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const dinerValues = [time, booking_date, number_of_guest, newUserId, message || null, body || null, 'pending'];
      const [dinerResult] = await connection.query<ResultSetHeader>(dinerSql, dinerValues);

      // Nếu tất cả thành công, commit transaction
      await connection.commit();

      // ✅ BƯỚC MỚI: Gửi email xác nhận sau khi commit thành công
      try {
        await sendBookingConfirmationEmail(userEmail, {
          userName,
          booking_date,
          time,
          number_of_guest,
          message
        });
      } catch (emailError) {
        return res.status(401).json({ code: 500, message: 'Email hoặc username đã tồn tại.' + emailError });
      }

      return res.status(201).json({
        message: 'Tạo người dùng và đơn đặt bàn thành công!',
        userId: newUserId,
        dinerId: dinerResult.insertId
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      if (error instanceof Error && 'code' in error && (error.code === 'ER_DUP_ENTRY')) {
        return res.status(409).json({ message: 'Email hoặc username đã tồn tại.' });
      }

      return res.status(500).json({ code: 500, message: 'Lỗi server', error: (error as Error).message });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  // Hàm getAllDiners
  public async getAllDiners(req: Request, res: Response): Promise<Response> {
    try {
      const sql = `
          SELECT 
              d.id, d.booking_date, d.time, d.number_of_guest, d.status,
              u.username as user_name, u.email as user_email 
          FROM diners d
          JOIN users u ON d.user_id = u.id
          ORDER BY d.created_at DESC
      `;

      const [rows] = await db.query<DinerWithUser[]>(sql);

      return res.status(200).json({
        code: 200,
        data: rows && rows.length > 0 ? rows : []
      });

    } catch (error) {
      return res.status(500).json({ code: 500, message: 'Lỗi server', error: (error as Error).message });
    }
  }
}

export default new DinerController();