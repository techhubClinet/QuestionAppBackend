const { validationResult } = require('express-validator');
const Question = require('../models/Question');
const Vote = require('../models/Vote');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIs18Plus(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

function getGuestId(req) {
  const raw = req.headers['x-guest-id'];
  const guestId = Array.isArray(raw) ? raw[0] : raw;
  if (!guestId) return null;
  const normalized = String(guestId).trim();
  if (!normalized || normalized.length > 128) return null;
  return normalized;
}

exports.getRandomQuestions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const include18Plus = req.query.include18Plus === 'true';

    const filter = { approved: true };
    if (!include18Plus) {
      filter.is18Plus = false;
    }

    // When user is logged in, exclude questions they already voted on
    if (req.user) {
      const votedQuestionIds = await Vote.find({ userId: req.user._id })
        .distinct('questionId');
      if (votedQuestionIds.length > 0) {
        filter._id = { $nin: votedQuestionIds };
      }
    }

    const questions = await Question.aggregate([
      { $match: filter },
      { $sample: { size: limit } },
      {
        $addFields: {
          acceptPercentage: {
            $round: [
              { $multiply: [{ $divide: ['$acceptVotes', { $add: ['$acceptVotes', '$rejectVotes'] }] }, 100] }
            ]
          },
          rejectPercentage: {
            $round: [
              { $multiply: [{ $divide: ['$rejectVotes', { $add: ['$acceptVotes', '$rejectVotes'] }] }, 100] }
            ]
          }
        }
      },
      {
        $addFields: {
          isAccepted: { $gte: ['$acceptPercentage', 50] }
        }
      }
    ]);

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.searchQuestions = async (req, res) => {
  try {
    const { q, include18Plus } = req.query;
    
    const filter = { approved: true };
    
    if (q && q.trim()) {
      filter.text = { $regex: q.trim(), $options: 'i' };
    }
    
    if (include18Plus !== 'true') {
      filter.is18Plus = false;
    }

    const questions = await Question.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const text = String(req.body.text || '').trim();
    const is18Plus = parseIs18Plus(req.body.is18Plus);
    const guestId = getGuestId(req);

    const existingApproved = await Question.findOne({
      text: { $regex: `^${escapeRegex(text)}$`, $options: 'i' },
      approved: true
    });

    if (existingApproved) {
      return res.status(400).json({ message: 'A similar question already exists' });
    }

    const question = await Question.create({
      text,
      is18Plus,
      createdBy: req.user?._id,
      createdByGuestId: req.user ? undefined : guestId,
      approved: false,
      acceptVotes: 1,
      rejectVotes: 1
    });

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getMyQuestions = async (req, res) => {
  try {
    const guestId = getGuestId(req);
    let filter = null;

    if (req.user) {
      filter = { createdBy: req.user._id };
    } else if (guestId) {
      filter = { createdByGuestId: guestId };
    } else {
      return res.status(400).json({ message: 'Missing user session or guest id' });
    }

    const questions = await Question.find(filter).sort({ createdAt: -1 });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const isOwner =
      req.user && question.createdBy && question.createdBy.toString() === req.user._id.toString();
    const isAdminUser = req.user && req.user.isAdmin;

    if (!question.approved && !isOwner && !isAdminUser) {
      return res.status(404).json({ message: 'Question not found' });
    }

    let userVote = null;
    if (req.user) {
      const vote = await Vote.findOne({
        userId: req.user._id,
        questionId: question._id
      });
      if (vote) {
        userVote = vote.voteType;
      }
    }

    res.json({
      ...question.toJSON(),
      userVote
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (question.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this question' });
    }

    const { text } = req.body;

    if (text) question.text = text.trim();
    if (req.body.is18Plus !== undefined) {
      question.is18Plus = parseIs18Plus(req.body.is18Plus);
    }

    if (!req.user.isAdmin) {
      question.approved = false;
    }

    await question.save();

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
