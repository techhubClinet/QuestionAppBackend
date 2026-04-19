const Question = require('../models/Question');
const Vote = require('../models/Vote');

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
