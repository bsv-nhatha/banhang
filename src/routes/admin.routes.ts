import express from 'express';
import adminController from '../controllers/admin.controller';
import dinerController from '../controllers/diner.controller';
import upload from '../middleware/upload';
import { authenticateAdmin } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/login', adminController.login);
router.post('/upload', authenticateAdmin, upload.single('image') as unknown as express.RequestHandler, adminController.uploadImage);
router.get('/banner-image', adminController.getLatestImage);
router.post('/diners/:id/confirm-success', authenticateAdmin, dinerController.confirmDinerSuccessByAdmin);

export default router;
