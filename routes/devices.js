const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const deviceController = require('../controllers/deviceController');

router.use(protect);

router.post('/push-token', deviceController.registerPushToken);
router.delete('/push-token', deviceController.unregisterPushToken);

module.exports = router;
