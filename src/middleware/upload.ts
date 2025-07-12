import multer from 'multer';
import path from 'path';

// Cấu hình nơi lưu trữ và tên file
const storage = multer.diskStorage({
  // Đích đến của file sau khi upload
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },

  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Middleware upload của Multer
const upload = multer({ storage: storage });

export default upload;