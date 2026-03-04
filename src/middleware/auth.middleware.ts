import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): Response | void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: 'Không có quyền truy cập.' });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ code: 500, message: 'Lỗi cấu hình server.' });
  }

  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ code: 401, message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
};
