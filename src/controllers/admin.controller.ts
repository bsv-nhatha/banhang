import { Request, Response } from 'express';
import db from '../config/db.config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2';
import sizeOf from 'image-size';
import fs from 'fs/promises';
import path from 'path';

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
  public uploadImage = async (req: Request, res: Response): Promise<Response> => {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'Vui lòng upload một file.' });
      }

      try {
        const imageBuffer = await fs.readFile(file.path);
        const dimensions = sizeOf(imageBuffer);

        if (dimensions.width === undefined || dimensions.height === undefined) {
          // Xóa file nếu không thể đọc được kích thước
          await fs.unlink(file.path);
          return res.status(400).json({ message: 'Không thể xác định kích thước của file.' });
        }

        // Kiểm tra kích thước tối thiểu
        if (dimensions.width < 1280 || dimensions.height < 720) {
          // Nếu không hợp lệ, xóa file đã upload và trả về lỗi
          await fs.unlink(file.path);
          return res.status(400).json({
            message: `Kích thước hình ảnh không hợp lệ. Yêu cầu tối thiểu: 1280x720, kích thước của bạn: ${dimensions.width}x${dimensions.height}.`
          });
        }

      } catch (validationError) {
        // Xóa file nếu có lỗi khi đọc kích thước (ví dụ: file không phải là hình ảnh)
        await fs.unlink(file.path);
        return res.status(400).json({ message: 'File upload không phải là định dạng hình ảnh hợp lệ.' });
      }

      try {
        const uploadsDir = path.join(__dirname, '../../public/uploads');
        const filesInDir = await fs.readdir(uploadsDir);

        if (filesInDir.length > 1) {
          const fileDetails = await Promise.all(
            filesInDir.map(async (f) => {
              const filePath = path.join(uploadsDir, f);
              const stats = await fs.stat(filePath);
              return { name: f, mtime: stats.mtime };
            })
          );
          
          // Sắp xếp file theo thời gian, mới nhất lên đầu
          fileDetails.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

          const oldFileToDelete = fileDetails[1].name;
          await fs.unlink(path.join(uploadsDir, oldFileToDelete));
          console.log(`Đã xóa file cũ thành công: ${oldFileToDelete}`);
        }
      } catch (deleteError) {
        // Nếu có lỗi khi xóa file cũ, chỉ cần ghi log và bỏ qua
        // Không làm ảnh hưởng đến kết quả upload thành công của file mới
        console.error('Không thể xóa file cũ:', deleteError);
      }

      // Nếu kích thước hợp lệ, tiếp tục xử lý
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

      return res.status(200).json({
        message: 'Upload hình ảnh thành công!',
        url: imageUrl,
      });

    } catch (error) {
      // Bắt các lỗi chung khác
      return res.status(500).json({ message: 'Lỗi server khi upload file.', error: (error as Error).message });
    }
  }
  public getLatestImage = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Xác định đường dẫn đến thư mục uploads
      const uploadsDir = path.join(__dirname, '../../public/uploads');

      // Đọc tất cả các file trong thư mục
      const files = await fs.readdir(uploadsDir);

      if(!files || files.length === 0) {
        return res.status(404).json({ message: 'Không tìm thấy hình ảnh nào.' });
      }

      // Lấy thông tin chi tiết (bao gồm thời gian chỉnh sửa - mtime) của từng file
      const fileDetails = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.stat(filePath);
          return { name: file, mtime: stats.mtime };
        })
      );

      // Sắp xếp các file theo thời gian chỉnh sửa, mới nhất lên đầu
      fileDetails.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // File mới nhất chính là file đầu tiên trong danh sách đã sắp xếp
      const latestFile = fileDetails[0];

      // Tạo URL đầy đủ cho file mới nhất
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${latestFile.name}`;

      return res.status(200).json({
        message: 'Lấy hình ảnh mới nhất thành công!',
        url: imageUrl,
        filename: latestFile.name,
        uploadedAt: latestFile.mtime,
      });

    } catch (error) {
      return res.status(500).json({ message: 'Lỗi server khi lấy hình ảnh.', error: (error as Error).message });
    }
  }
}

export default new AdminController();