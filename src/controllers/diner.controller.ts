import { Request, Response } from 'express';
import db from '../config/db.config';
import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import {
  sendBookingConfirmationEmail,
  sendNewBookingNotificationToAdmin,
} from '../services/emailService';

/* ============================= */
/*            TYPES              */
/* ============================= */

interface CreateDinerAndUserBody {
  userName: string;
  userEmail: string;
  userPhoneNumber?: string;

  time: string;
  booking_date: string;
  number_of_guest: number;
  message?: string;
  body?: string;
}

interface DinerWithUser extends RowDataPacket {
  id: number;
  booking_date: string;
  time: string;
  number_of_guest: number;
  status: string;
  message: string | null;
  user_name: string;
  user_email: string;
  phone: string | null;
}

interface DinerDetail extends DinerWithUser {}
interface DinerConfirmTarget extends RowDataPacket {
  id: number;
  booking_date: string;
  time: string;
  number_of_guest: number;
  status: string;
  message: string | null;
  user_name: string;
  user_email: string;
}

/* ============================= */
/*         CONTROLLER            */
/* ============================= */

class DinerController {
  /* ===================================== */
  /*        CREATE DINER + USER            */
  /* ===================================== */

  public createDinerFromUser = async (
    req: Request<{}, {}, CreateDinerAndUserBody>,
    res: Response
  ): Promise<Response> => {
    let connection: PoolConnection | undefined;

    try {
      const {
        userName,
        userEmail,
        userPhoneNumber,
        time,
        booking_date,
        number_of_guest,
        message,
        body,
      } = req.body;

      /* ---------- VALIDATION ---------- */

      if (
        !userName ||
        !userEmail ||
        !time ||
        !booking_date ||
        number_of_guest === undefined
      ) {
        return res
          .status(400)
          .json({ message: 'Vui lòng điền đủ các trường bắt buộc.' });
      }

      const parsedGuestNumber = Number(number_of_guest);

      if (Number.isNaN(parsedGuestNumber) || parsedGuestNumber <= 0) {
        return res
          .status(400)
          .json({ message: 'Số lượng khách không hợp lệ.' });
      }

      /* ---------- TRANSACTION ---------- */

      connection = await db.getConnection();
      await connection.beginTransaction();

      let userId: number;

      const checkUserSql =
        'SELECT id FROM users WHERE username = ? AND email = ? AND phone_number <=> ? LIMIT 1';

      const [existingUsers] = await connection.query<RowDataPacket[]>(
        checkUserSql,
        [userName, userEmail, userPhoneNumber ?? null]
      );

      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
      } else {
        const insertUserSql =
          'INSERT INTO users (username, email, phone_number) VALUES (?, ?, ?)';
        const [userResult] = await connection.query<ResultSetHeader>(
          insertUserSql,
          [userName, userEmail, userPhoneNumber ?? null]
        );

        userId = userResult.insertId;
      }

      const insertDinerSql = `
        INSERT INTO diners 
        (time, booking_date, number_of_guest, user_id, message, body, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [dinerResult] = await connection.query<ResultSetHeader>(
        insertDinerSql,
        [
          time,
          booking_date,
          parsedGuestNumber,
          userId,
          message ?? null,
          body ?? null,
          'pending',
        ]
      );

      await connection.commit();

      /* ---------- SEND EMAIL (NON-BLOCKING FAILURE) ---------- */

      try {
        await sendNewBookingNotificationToAdmin({
          userName,
          userEmail,
          userPhoneNumber,
          booking_date,
          time,
          number_of_guest: parsedGuestNumber,
          message,
        });
      } catch (emailError) {
        console.error('[EMAIL_SEND_ERROR]', emailError);
      }

      return res.status(201).json({
        message: 'Tạo đơn đặt bàn thành công!',
        userId,
        dinerId: dinerResult.insertId,
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      return res.status(500).json({
        code: 500,
        message: 'Lỗi server',
        error: (error as Error).message,
      });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

  /* ===================================== */
  /*            GET ALL DINERS             */
  /* ===================================== */

  public async getAllDiners(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const sql = `
        SELECT 
            d.id,
            d.booking_date,
            d.time,
            d.number_of_guest,
            d.status,
            d.message,
            u.username as user_name,
            u.email as user_email,
            u.phone_number as phone
        FROM diners d
        JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC
      `;

      const [rows] = await db.query<DinerWithUser[]>(sql);

      return res.status(200).json({
        code: 200,
        data: rows ?? [],
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        message: 'Lỗi server',
        error: (error as Error).message,
      });
    }
  }

  /* ===================================== */
  /*            GET DINER BY ID            */
  /* ===================================== */

  public async getDinerById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const id = Number(req.params.id);

      if (!id || Number.isNaN(id)) {
        return res.status(400).json({
          code: 400,
          message: 'ID không hợp lệ.',
        });
      }

      const sql = `
          SELECT
              d.id,
              d.booking_date,
              d.time,
              d.number_of_guest,
              d.status,
              d.message,
              u.username as user_name,
              u.email as user_email,
              u.phone_number as phone
          FROM diners d
                   JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
      `;

      const [rows] = await db.query<DinerDetail[]>(sql, [id]);

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: 'Không tìm thấy lượt đặt bàn.',
        });
      }

      return res.status(200).json({
        code: 200,
        data: rows[0],
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        message: 'Lỗi server',
        error: (error as Error).message,
      });
    }
  }

  public confirmDinerSuccessByAdmin = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      const id = Number(req.params.id);

      if (!id || Number.isNaN(id)) {
        return res.status(400).json({
          code: 400,
          message: 'ID không hợp lệ.',
        });
      }

      const findSql = `
          SELECT
              d.id,
              d.booking_date,
              d.time,
              d.number_of_guest,
              d.status,
              d.message,
              u.username as user_name,
              u.email as user_email
          FROM diners d
          JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
          LIMIT 1
      `;

      const [rows] = await db.query<DinerConfirmTarget[]>(findSql, [id]);

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: 'Không tìm thấy lượt đặt bàn.',
        });
      }

      const diner = rows[0];

      if (diner.status === 'success') {
        return res.status(200).json({
          code: 200,
          message: 'Lượt đặt bàn đã ở trạng thái success.',
          dinerId: diner.id,
          status: diner.status,
        });
      }

      await sendBookingConfirmationEmail(diner.user_email, {
        userName: diner.user_name,
        booking_date: diner.booking_date,
        time: diner.time,
        number_of_guest: Number(diner.number_of_guest),
        message: diner.message ?? undefined,
      });

      await db.query<ResultSetHeader>(
        'UPDATE diners SET status = ? WHERE id = ?',
        ['success', id]
      );

      return res.status(200).json({
        code: 200,
        message:
          'Gửi email cho khách hàng thành công và cập nhật trạng thái success.',
        dinerId: diner.id,
        status: 'success',
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        message: 'Lỗi server',
        error: (error as Error).message,
      });
    }
  };
}

export default new DinerController();
