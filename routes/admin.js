const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

router.get('/questions', adminController.getAllQuestions);

router.post('/questions', adminController.createQuestionAdmin);

router.get('/questions/pending', adminController.getPendingQuestions);

router.post('/questions/:id/approve', adminController.approveQuestion);

router.delete('/questions/:id', adminController.deleteQuestion);

module.exports = router;
