const Vote = require('../models/Vote');
const Question = require('../models/Question');

exports.createOrUpdateVote = async (req, res) => {
  try {
    const { questionId, voteType } = req.body;

    if (!questionId || !voteType) {
      return res.status(400).json({ message: 'questionId and voteType are required' });
    }

    if (!['accept', 'reject'].includes(voteType)) {
      return res.status(400).json({ message: 'voteType must be "accept" or "reject"' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (!question.approved) {
      return res.status(403).json({ message: 'This question is not live yet (pending admin approval)' });
    }

    const isAnonymous = !req.user;

    if (isAnonymous) {
      if (voteType === 'accept') {
        question.acceptVotes += 1;
      } else {
        question.rejectVotes += 1;
      }
      await question.save();

      const total = question.acceptVotes + question.rejectVotes;
      const acceptPercentage = Math.round((question.acceptVotes / total) * 100);
      const rejectPercentage = Math.round((question.rejectVotes / total) * 100);

      return res.status(201).json({
        message: 'Vote recorded',
        vote: null,
        question: {
          ...question.toJSON(),
          acceptPercentage,
          rejectPercentage,
          isAccepted: acceptPercentage >= 50
        }
      });
    }

    const existingVote = await Vote.findOne({
      userId: req.user._id,
      questionId
    });

    if (existingVote) {
      const previousVoteType = existingVote.voteType;
      // Allow changing vote on the same question (accept <-> reject).
      if (existingVote.voteType !== voteType) {
        if (existingVote.voteType === 'accept') {
          question.acceptVotes = Math.max(0, question.acceptVotes - 1);
          question.rejectVotes += 1;
        } else {
          question.rejectVotes = Math.max(0, question.rejectVotes - 1);
          question.acceptVotes += 1;
        }
        existingVote.voteType = voteType;
        existingVote.updatedAt = new Date();
        await Promise.all([question.save(), existingVote.save()]);
      }

      const total = question.acceptVotes + question.rejectVotes;
      const acceptPercentage = Math.round((question.acceptVotes / total) * 100);
      const rejectPercentage = Math.round((question.rejectVotes / total) * 100);
      return res.status(200).json({
        message: previousVoteType === voteType ? 'Vote recorded' : 'Vote updated',
        vote: existingVote,
        question: {
          ...question.toJSON(),
          acceptPercentage,
          rejectPercentage,
          isAccepted: acceptPercentage >= 50,
          userVote: existingVote.voteType
        }
      });
    }

    const vote = await Vote.create({
      userId: req.user._id,
      questionId,
      voteType
    });

    if (voteType === 'accept') {
      question.acceptVotes += 1;
    } else {
      question.rejectVotes += 1;
    }
    await question.save();

    const total = question.acceptVotes + question.rejectVotes;
    const acceptPercentage = Math.round((question.acceptVotes / total) * 100);
    const rejectPercentage = Math.round((question.rejectVotes / total) * 100);

    res.status(201).json({
      message: 'Vote recorded',
      vote,
      question: {
        ...question.toJSON(),
        acceptPercentage,
        rejectPercentage,
        isAccepted: acceptPercentage >= 50,
        userVote: voteType
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getUserVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ userId: req.user._id })
      .populate('questionId')
      .sort({ updatedAt: -1 });

    res.json(votes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
