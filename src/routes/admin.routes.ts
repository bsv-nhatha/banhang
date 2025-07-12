import express from 'express';
import adminController from '../controllers/admin.controller';
import upload from '../middleware/upload';

const router = express.Router();

router.post('/login', adminController.login);
router.post('/upload', upload.single('image'), adminController.uploadImage);
router.get('/banner-image', adminController.getLatestImage);

export default router;