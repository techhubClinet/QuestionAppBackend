const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null,
      index: true
    },
    token: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'unknown'],
      default: 'unknown'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastSuccessAt: {
      type: Date,
      default: null
    },
    lastFailure: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

deviceTokenSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
