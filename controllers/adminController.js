const Question = require('../models/Question');
const Vote = require('../models/Vote');

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
      .sort({ createdAt: -1 });

    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
