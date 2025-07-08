import express from 'express';
import dinerController from '../controllers/diner.controller';

const router = express.Router();

router.post('/create', dinerController.createDinerFromUser);
router.get('/', dinerController.getAllDiners);

export default router;