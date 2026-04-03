const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { protect, optionalAuth } = require('../middleware/auth');

router.post('/', optionalAuth, voteController.createOrUpdateVote);

router.get('/my', protect, voteController.getUserVotes);

module.exports = router;
