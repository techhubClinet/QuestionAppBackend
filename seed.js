require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Question = require('./models/Question');
const sampleQuestions = require('./data/seedQuestions.json');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await Question.deleteMany({});

    const adminUser = await User.create({
      email: 'admin@mamekubal.com',
      password: 'admin123',
      isAdmin: true
    });

    const testUser = await User.create({
      email: 'test@mamekubal.com',
      password: 'test123',
      isAdmin: false
    });

    console.log('Users created');

    const questions = await Question.insertMany(
      sampleQuestions.map(q => ({
        ...q,
        createdBy: adminUser._id,
        approved: true,
        acceptVotes: 1,
        rejectVotes: 1
      }))
    );

    console.log(`${questions.length} questions created`);
    console.log('\nSeed completed successfully!');
    console.log('\nTest accounts:');
    console.log('Admin: admin@mamekubal.com / admin123');
    console.log('User: test@mamekubal.com / test123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
