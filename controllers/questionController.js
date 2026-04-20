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

exports.getRandomQuestions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const include18Plus = req.query.include18Plus === 'true';

    const baseFilter = { approved: true };
    if (!include18Plus) {
      baseFilter.is18Plus = false;
    }

    const runSample = async (matchFilter) => {
      return Question.aggregate([
        { $match: matchFilter },
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
    };

    let votedQuestionIds = [];
    if (req.user) {
      votedQuestionIds = await Vote.find({ userId: req.user._id }).distinct('questionId');
    }

    const unseenFilter = { ...baseFilter };
    if (votedQuestionIds.length > 0) {
      unseenFilter._id = { $nin: votedQuestionIds };
    }

    let questions = await runSample(unseenFilter);

    /**
     * Fallback: if a logged-in user has voted on all matching questions,
     * still return random approved questions instead of empty state.
     */
    if (questions.length === 0 && req.user) {
      questions = await runSample(baseFilter);
    }

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
    const questions = await Question.find({ createdBy: req.user._id }).sort({ createdAt: -1 });

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

    const isAdmin = req.user.isAdmin;
    const isOwner =
      question.createdBy &&
      question.createdBy.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to edit this question' });
    }

    const { text } = req.body;

    if (text !== undefined && text !== null && String(text).trim() !== '') {
      question.text = String(text).trim();
    }
    if (req.body.is18Plus !== undefined) {
      question.is18Plus = parseIs18Plus(req.body.is18Plus);
    }

    if (!isAdmin && isOwner) {
      question.approved = false;
    }

    await question.save();

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
