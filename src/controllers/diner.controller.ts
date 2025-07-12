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

interface DinerDetail extends RowDataPacket {
  id: number;
  booking_date: string;
  time: string;
  number_of_guest: string;
  status: string;
  message: string | null;
  user_name: string;
  user_email: string;
  phone: string | null;
}

class DinerController {
  // ✅ Viết lại logic hàm để xử lý việc tạo cả hai bản ghi
  public createDinerFromUser = async (req: Request<{}, {}, CreateDinerAndUserBody>, res: Response): Promise<Response> => {
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

      let userId: number;

      // ✅ BƯỚC 1: Câu lệnh SQL mới để kiểm tra user với 3 điều kiện AND
      const checkUserSql = 'SELECT id FROM users WHERE username = ? AND email = ? AND phone_number = ? LIMIT 1';
      const checkUserValues = [userName, userEmail, userPhoneNumber || null];

      // ✅ BƯỚC 2: Thực thi câu lệnh kiểm tra
      const [existingUsers] = await connection.query<RowDataPacket[]>(checkUserSql, checkUserValues);

      // BƯỚC 3: Nếu user đã tồn tại (khớp cả 3 trường), lấy id. Nếu không, tạo user mới.
      if (existingUsers.length > 0) {
        // User đã tồn tại, sử dụng id của họ
        userId = existingUsers[0].id;
        console.log(`User da ton tai voi ID: ${userId}`);
      } else {
        // User chưa tồn tại, tạo mới
        console.log('User chua ton tai, tien hanh tao moi.');
        const userSql = 'INSERT INTO users (username, email, phone_number) VALUES (?, ?, ?)';
        const userValues = [userName, userEmail, userPhoneNumber || null];
        const [userResult] = await connection.query<ResultSetHeader>(userSql, userValues);
        userId = userResult.insertId;
      }

      // BƯỚC 4: Dùng userId để tạo Diner
      const dinerSql = 'INSERT INTO diners (time, booking_date, number_of_guest, user_id, message, body, status) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const dinerValues = [time, booking_date, number_of_guest, userId, message || null, body || null, 'pending'];
      const [dinerResult] = await connection.query<ResultSetHeader>(dinerSql, dinerValues);

      // BƯỚC 5: Commit transaction
      await connection.commit();

      // BƯỚC 6: Gửi email xác nhận
      try {
        await sendBookingConfirmationEmail(userEmail, {
          userName, booking_date, time, number_of_guest, message
        });
      } catch (emailError) {
        console.error('Lỗi gửi email phụ trợ:', emailError);
      }

      return res.status(201).json({
        message: 'Tạo đơn đặt bàn thành công!',
        userId: userId,
        dinerId: dinerResult.insertId
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
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
              d.id, d.booking_date, d.time, d.number_of_guest, d.status, d.message,
              u.username as user_name, u.email as user_email, u.phone_number as phone
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

  public async getDinerById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ code: 400, message: 'Vui lòng cung cấp ID của lượt đặt bàn.' });
      }

      const sql = `
          SELECT 
              d.id, d.booking_date, d.time, d.number_of_guest, d.status, d.message,
              u.username as user_name, u.email as user_email, u.phone_number as phone
          FROM diners d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
      `;

      const [rows] = await db.query<DinerDetail[]>(sql, [id]);

      // Kiểm tra xem có tìm thấy bản ghi nào không
      if (rows.length === 0) {
        return res.status(404).json({ code: 404, message: 'Không tìm thấy lượt đặt bàn với ID đã cung cấp.' });
      }

      // Trả về bản ghi đầu tiên tìm được
      return res.status(200).json({
        code: 200,
        data: rows[0]
      });

    } catch (error) {
      return res.status(500).json({ code: 500, message: 'Lỗi server', error: (error as Error).message });
    }
  }
}

export default new DinerController();