import { Request, Response } from 'express';
import db from '../config/db.config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';

interface Admin extends RowDataPacket {
  id: number;
  username: string;
  password: string;
}

class AdminController {
  public login = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập username và password.' });
      }

      const [rows] = await db.query<Admin[]>('SELECT * FROM admin WHERE username = ?', [username]);
      const admin = rows[0];

      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ message: 'Username hoặc password không chính xác.' });
      }

      const jwtSecret = process.env.JWT_SECRET || 'your_default_secret_key';
      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        jwtSecret,
        { expiresIn: '1h' }
      );

      return res.status(200).json({
        code: 200,
        message: 'Đăng nhập thành công',
        token: token,
      });

    } catch (error) {
      return res.status(500).json({ code: 500, message: 'Lỗi server', error: (error as Error).message });
    }
  }
}

export default new AdminController();