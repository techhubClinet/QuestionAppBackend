/**
 * Inserts seed questions from ../data/seedQuestions.json without deleting users.
 * Skips any question whose text already exists (case-insensitive), same idea as createQuestion.
 *
 * Usage (from backend/):  node scripts/importSeedQuestions.js
 * Requires MONGODB_URI in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Question = require('../models/Question');
const seedQuestions = require('../data/seedQuestions.json');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveAuthorId() {
  const admin = await User.findOne({ isAdmin: true });
  if (admin) return admin._id;

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin1234@gmail.com').trim().toLowerCase();
  const byEnv = await User.findOne({ email: adminEmail });
  if (byEnv) return byEnv._id;

  const any = await User.findOne().sort({ createdAt: 1 });
  if (any) return any._id;

  return null;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI. Set it in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const createdBy = await resolveAuthorId();
  if (!createdBy) {
    console.error(
      'No user found. Register once in the app (or run full seed: node seed.js), then run this script again.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const q of seedQuestions) {
    const text = String(q.text || '').trim();
    if (!text) continue;

    const exists = await Question.findOne({
      text: { $regex: `^${escapeRegex(text)}$`, $options: 'i' }
    });

    if (exists) {
      skipped += 1;
      continue;
    }

    await Question.create({
      text,
      is18Plus: !!q.is18Plus,
      createdBy,
      approved: true,
      acceptVotes: 1,
      rejectVotes: 1
    });
    inserted += 1;
  }

  console.log(`Done. Inserted ${inserted}, skipped (already present) ${skipped}.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  mongoose.disconnect().finally(() => process.exit(1));
});
