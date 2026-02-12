import { Request, Response } from 'express';
import db from '../config/db.config';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { sendBookingConfirmationEmail } from '../services/emailService';

interface CreateDinerAndUserBody {
  userName: string;
  userEmail: string;
  userPhoneNumber?: string;

  time: string;
  booking_date: string;
  number_of_guest: string;
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

class DinerController {
  private async findExistingUser(
    connection: PoolConnection,
    userName: string,
    userEmail: string,
    userPhoneNumber?: string
  ): Promise<number | null> {
    let sql = '';
    let values: any[] = [];

    if (userPhoneNumber) {
      sql = `
        SELECT id FROM users
        WHERE username = ?
          AND email = ?
          AND phone_number = ?
        LIMIT 1
      `;
      values = [userName, userEmail, userPhoneNumber];
    } else {
      sql = `
        SELECT id FROM users
        WHERE username = ?
          AND email = ?
          AND phone_number IS NULL
        LIMIT 1
      `;
      values = [userName, userEmail];
    }

    const [rows] = await connection.query<RowDataPacket[]>(sql, values);
    return rows.length > 0 ? rows[0].id : null;
  }

  private async createUser(
    connection: PoolConnection,
    userName: string,
    userEmail: string,
    userPhoneNumber?: string
  ): Promise<number> {
    const sql = `
      INSERT INTO users (username, email, phone_number)
      VALUES (?, ?, ?)
    `;
    const [result] = await connection.query<ResultSetHeader>(sql, [
      userName,
      userEmail,
      userPhoneNumber || null,
    ]);

    return result.insertId;
  }

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

      if (!userName || !userEmail || !time || !booking_date || !number_of_guest) {
        return res.status(400).json({
          code: 400,
          message: 'Missing required fields',
        });
      }
      return res.status(500).json({
        code: 400,
        message: 'hiện tại đã nhà hàng đã full bàn \n xin lỗi vì sự bất tiện này',
      });

      const guestCount = Number(number_of_guest);
      if (Number.isNaN(guestCount) || guestCount <= 0) {
        return res.status(400).json({
          code: 400,
          message: 'Invalid number_of_guest',
        });
      }


      connection = await db.getConnection();
      await connection.beginTransaction();

      let userId =
        (await this.findExistingUser(
          connection,
          userName,
          userEmail,
          userPhoneNumber
        )) || 0;

      if (!userId) {
        userId = await this.createUser(
          connection,
          userName,
          userEmail,
          userPhoneNumber
        );
      }

      const dinerSql = `
        INSERT INTO diners
          (time, booking_date, number_of_guest, user_id, message, body, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [dinerResult] = await connection.query<ResultSetHeader>(
        dinerSql,
        [
          time,
          booking_date,
          guestCount,
          userId,
          message || null,
          body || null,
          'pending',
        ]
      );

      await connection.commit();

      // Email should not break main flow
      try {
        await sendBookingConfirmationEmail(userEmail, {
          userName,
          booking_date,
          time,
          number_of_guest: guestCount,
          message,
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return res.status(201).json({
        code: 201,
        message: 'Booking created successfully',
        userId,
        dinerId: dinerResult.insertId,
      });
    } catch (error) {
      if (connection) await connection.rollback();

      return res.status(500).json({
        code: 500,
        message: 'Internal server error',
        error: (error as Error).message,
      });
    } finally {
      if (connection) connection.release();
    }
  };

  public async getAllDiners(req: Request, res: Response): Promise<Response> {
    try {
      const sql = `
          SELECT
              d.id,
              d.booking_date,
              d.time,
              d.number_of_guest,
              d.status,
              d.message,
              u.username AS user_name,
              u.email AS user_email,
              u.phone_number AS phone
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
        message: 'Internal server error',
        error: (error as Error).message,
      });
    }
  }

  public async getDinerById(req: Request, res: Response): Promise<Response> {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({
          code: 400,
          message: 'Invalid diner ID',
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
              u.username AS user_name,
              u.email AS user_email,
              u.phone_number AS phone
          FROM diners d
                   JOIN users u ON d.user_id = u.id
          WHERE d.id = ?
              LIMIT 1
      `;

      const [rows] = await db.query<DinerDetail[]>(sql, [id]);

      if (!rows.length) {
        return res.status(404).json({
          code: 404,
          message: 'Diner not found',
        });
      }

      return res.status(200).json({
        code: 200,
        data: rows[0],
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        message: 'Internal server error',
        error: (error as Error).message,
      });
    }
  }
}

export default new DinerController();