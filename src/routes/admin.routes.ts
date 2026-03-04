import express from 'express';
import adminController from '../controllers/admin.controller';
import dinerController from '../controllers/diner.controller';
import upload from '../middleware/upload';

const router = express.Router();

router.post('/login', adminController.login);
router.post('/upload', upload.single('image') as unknown as express.RequestHandler, adminController.uploadImage);
router.get('/banner-image', adminController.getLatestImage);
router.post('/diners/:id/confirm-success', dinerController.confirmDinerSuccessByAdmin);

export default router;
