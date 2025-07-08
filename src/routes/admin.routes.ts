import express from 'express';
import adminController from '../controllers/admin.controller';

const router = express.Router();

router.post('/login', adminController.login);

export default router;