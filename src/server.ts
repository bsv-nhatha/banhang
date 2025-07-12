import express, { Express, Request, Response } from 'express';
import 'dotenv/config';
import cors from 'cors';
import path from 'path';

// Import các routes
import adminRoutes from './routes/admin.routes';
import dinerRoutes from './routes/diner.routes';
// import userRoutes from './routes/user.routes'; // Nếu có

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Chào mừng đến với API Nhà hàng (TypeScript Version).' });
});

// Sử dụng các routes
app.use('/api/admin', adminRoutes);
app.use('/api/diners', dinerRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT} với TypeScript.`);
});