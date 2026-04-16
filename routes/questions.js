const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/random', optionalAuth, questionController.getRandomQuestions);

router.get('/search', optionalAuth, questionController.searchQuestions);

router.get('/my', protect, questionController.getMyQuestions);

router.get('/:id', optionalAuth, questionController.getQuestionById);

router.post(
  '/',
  optionalAuth,
  [
    body('text')
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Question must be between 10 and 500 characters')
  ],
  questionController.createQuestion
);

router.put(
  '/:id',
  protect,
  [
    body('text')
      .optional()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage('Question must be between 10 and 500 characters')
  ],
  questionController.updateQuestion
);

module.exports = router;
