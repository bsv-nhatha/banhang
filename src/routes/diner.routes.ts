import express from 'express';
import dinerController from '../controllers/diner.controller';
import { bookingEmailRateLimit, bookingIpRateLimit } from '../middleware/rateLimit';
import { authenticateAdmin } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/create', bookingIpRateLimit, bookingEmailRateLimit, dinerController.createDinerFromUser);
router.get('/', authenticateAdmin, dinerController.getAllDiners);
router.get('/:id', authenticateAdmin, dinerController.getDinerById);
router.post('/:id/confirm-success', authenticateAdmin, dinerController.confirmDinerSuccessByAdmin);

export default router;
