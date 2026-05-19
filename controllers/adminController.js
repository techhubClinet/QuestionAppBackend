const Question = require('../models/Question');
const Vote = require('../models/Vote');
const NotificationCampaign = require('../models/NotificationCampaign');
const DeviceToken = require('../models/DeviceToken');
const { sendCampaignPush } = require('../services/notificationCampaignService');

function parseIs18Plus(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

exports.getPendingQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ approved: false })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.approveQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    question.approved = true;
    await question.save();

    const populated = await Question.findById(question._id).populate('createdBy', 'email');

    res.json({ message: 'Question approved', question: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Hard delete — used when admin rejects a pending question.
 * The document is removed from MongoDB (rejected questions are not kept).
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const wasPending = !question.approved;

    await Vote.deleteMany({ questionId: question._id });
    await Question.findByIdAndDelete(req.params.id);

    res.json({
      message: wasPending
        ? 'Question rejected and removed from the database'
        : 'Question deleted'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getAllQuestions = async (req, res) => {
  try {
    const questions = await Question.find()
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .lean();

    const ids = questions.map((q) => q._id);
    let statsById = {};

    if (ids.length > 0) {
      const voteStats = await Vote.aggregate([
        { $match: { questionId: { $in: ids } } },
        {
          $group: {
            _id: '$questionId',
            responderCount: { $sum: 1 },
            registeredYes: {
              $sum: { $cond: [{ $eq: ['$voteType', 'accept'] }, 1, 0] }
            },
            registeredNo: {
              $sum: { $cond: [{ $eq: ['$voteType', 'reject'] }, 1, 0] }
            }
          }
        }
      ]);

      statsById = Object.fromEntries(
        voteStats.map((row) => [
          row._id.toString(),
          {
            responderCount: row.responderCount,
            registeredYes: row.registeredYes,
            registeredNo: row.registeredNo
          }
        ])
      );
    }

    const enriched = questions.map((q) => {
      const s = statsById[q._id.toString()] || {
        responderCount: 0,
        registeredYes: 0,
        registeredNo: 0
      };
      return {
        ...q,
        voteStats: s,
        poolYes: q.acceptVotes,
        poolNo: q.rejectVotes
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/** Admin adds a question directly (optionally already approved / live). */
exports.createQuestionAdmin = async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (text.length < 10 || text.length > 500) {
      return res.status(400).json({ message: 'Question must be between 10 and 500 characters' });
    }

    const is18Plus = parseIs18Plus(req.body.is18Plus);
    const approved = req.body.approved !== false && req.body.approved !== 'false';

    const question = await Question.create({
      text,
      is18Plus,
      createdBy: req.user._id,
      approved,
      acceptVotes: 1,
      rejectVotes: 1
    });

    const populated = await Question.findById(question._id).populate('createdBy', 'email');
    const q = populated.toObject();
    q.voteStats = { responderCount: 0, registeredYes: 0, registeredNo: 0 };
    q.poolYes = q.acceptVotes;
    q.poolNo = q.rejectVotes;

    res.status(201).json(q);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getNotificationCampaign = async (req, res) => {
  try {
    const campaign = await NotificationCampaign.findOne().sort({ updatedAt: -1 });
    if (!campaign) {
      return res.json({
        message: '',
        frequency: 'weekly',
        isEnabled: false
      });
    }
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.upsertNotificationCampaign = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const frequency = String(req.body.frequency || '').trim();
    const isEnabled = req.body.isEnabled === true || req.body.isEnabled === 'true';

    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ message: 'Frequency must be daily, weekly, or monthly' });
    }
    if (!message || message.length < 2 || message.length > 280) {
      return res.status(400).json({ message: 'Message must be between 2 and 280 characters' });
    }

    let campaign = await NotificationCampaign.findOne().sort({ updatedAt: -1 });
    if (!campaign) {
      campaign = await NotificationCampaign.create({
        message,
        frequency,
        isEnabled,
        updatedBy: req.user._id
      });
    } else {
      campaign.message = message;
      campaign.frequency = frequency;
      campaign.isEnabled = isEnabled;
      campaign.updatedBy = req.user._id;
      await campaign.save();
    }

    res.json(campaign);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPushDeviceStats = async (req, res) => {
  try {
    const [active, total] = await Promise.all([
      DeviceToken.countDocuments({ isActive: true }),
      DeviceToken.countDocuments({})
    ]);
    res.json({ active, total });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.sendNotificationCampaignNow = async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    let campaign = await NotificationCampaign.findOne().sort({ updatedAt: -1 });

    if (message) {
      const frequency = String(req.body.frequency || campaign?.frequency || 'daily').trim();
      if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
        return res.status(400).json({ message: 'Frequency must be daily, weekly, or monthly' });
      }
      if (message.length < 2 || message.length > 280) {
        return res.status(400).json({ message: 'Message must be between 2 and 280 characters' });
      }
      if (!campaign) {
        campaign = await NotificationCampaign.create({
          message,
          frequency,
          isEnabled: true,
          updatedBy: req.user._id
        });
      } else {
        campaign.message = message;
        campaign.frequency = frequency;
        campaign.isEnabled = true;
        campaign.updatedBy = req.user._id;
        await campaign.save();
      }
    }

    if (!campaign) {
      return res.status(404).json({ message: 'No notification campaign found. Save a message first.' });
    }

    const result = await sendCampaignPush(campaign, new Date());
    res.json({
      message: `Push sent to ${result.sent} devices`,
      sent: result.sent,
      invalidated: result.invalidated,
      notificationId: result.notification?._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
