import express from 'express';
import dinerController from '../controllers/diner.controller';
import { bookingEmailRateLimit } from '../middleware/rateLimit';
const router = express.Router();

router.post('/create',bookingEmailRateLimit, dinerController.createDinerFromUser);
router.get('/', dinerController.getAllDiners);
router.get('/:id', dinerController.getDinerById);

export default router;