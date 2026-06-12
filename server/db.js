const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PATH = path.join(__dirname, 'data', 'database.json');
let useMongo = false;

// 1. MONGODB SHEMAS & CONFIGS
const UserHabitSchema = new mongoose.Schema({
  wakeTime: { type: String, default: "06:30" },
  sleepTime: { type: String, default: "22:30" },
  meals: { type: String, default: "3" },
  foodPreference: { type: String, default: "veg" },
  age: { type: String, default: "23" },
  location: { type: String, default: "Delhi" },
  nickname: { type: String, default: "sister" }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String },
  googleId: { type: String },
  email: { type: String },
  habits: { type: UserHabitSchema, default: null }
});

const SessionSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  cycles: { type: Array, default: [] },
  waterLogged: { type: Number, default: 0 },
  waterStreak: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastActiveDate: { type: String, default: null },
  badges: { type: [String], default: [] },
  checklist: { type: Map, of: Boolean, default: {} },
  moodLogs: { type: Map, of: new mongoose.Schema({ mood: Number, sleep: Number, notes: String }, { _id: false }), default: {} },
  journal: { type: Array, default: [] }
});

const CommunitySchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  author: { type: String, default: "Anonymous" },
  time: { type: String, default: "Just now" },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  relates: { type: Number, default: 0 }
});

const UserModel = mongoose.model('User', UserSchema);
const SessionModel = mongoose.model('Session', SessionSchema);
const CommunityModel = mongoose.model('Community', CommunitySchema);

let isConnected = false;
let connectingPromise = null;

async function connectDb() {
  if (isConnected) return true;
  if (!MONGODB_URI) {
    useMongo = false;
    return false;
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    console.log("Connected to MongoDB successfully! 🍃");
    useMongo = true;
    isConnected = true;
    return true;
  })
  .catch(err => {
    console.warn("MongoDB connection failed, falling back to in-memory database. Error:", err.message);
    useMongo = false;
    isConnected = false;
    connectingPromise = null;
    return false;
  });

  return connectingPromise;
}

// 2. MOCKED IN-MEMORY FALLBACK LAYER
const defaultCommunity = [
  {
    id: "seed-1",
    author: "Ananya",
    time: "2 hours ago",
    content: "Anyone else have chest hair from PCOD? You're not alone. I used to be so embarrassed, but spearmint tea and clean diet have started making a difference. Stay strong, sisters! 🌸",
    tags: ["PCOD", "Lifestyle"],
    relates: 24
  },
  {
    id: "seed-2",
    author: "Ritu",
    time: "5 hours ago",
    content: "My period was missing for 3 months. I was super scared of going to the doctor, but my sister supported me. It turns out it was high stress + bad sleep. Setting a 10:30 PM sleeping goal helped reset it.",
    tags: ["Periods", "Sleep"],
    relates: 18
  },
  {
    id: "seed-3",
    author: "Aditi",
    time: "Yesterday",
    content: "PCOD diet that actually worked for me as a South Indian: Replacing white rice with red rice / brown rice, adding more dal, and avoiding coffee right before my periods.",
    tags: ["Diet", "PCOD"],
    relates: 32
  }
];

let inMemoryDb = {
  users: {},
  sessions: {},
  community: [...defaultCommunity]
};

function setupJsonDb() {
  useMongo = false;
}

function readDb() {
  return inMemoryDb;
}

function writeDb(data) {
  inMemoryDb = data;
}

// 3. DATABASE ACCESS INTERFACE (Supports Mongo + JSON Fallback)
async function registerUser(username, password, googleId = null, email = null) {
  if (useMongo) {
    try {
      const exists = await UserModel.findOne({ username });
      if (exists) return { success: false, error: "Username already exists" };
      
      const newUser = new UserModel({ username, password, googleId, email });
      await newUser.save();
      
      const newSession = new SessionModel({ username });
      await newSession.save();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    const db = readDb();
    if (db.users[username]) return { success: false, error: "Username already exists" };
    db.users[username] = { password, googleId, email, habits: null };
    db.sessions[username] = { cycles: [], waterLogged: 0, waterStreak: 0, dailyStreak: 0, lastActiveDate: null, badges: [], checklist: {}, moodLogs: {}, journal: [] };
    writeDb(db);
    return { success: true };
  }
}

async function findOrCreateGoogleUser(googleId, email, name) {
  const generatedUsername = name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000);
  if (useMongo) {
    try {
      let user = await UserModel.findOne({ googleId });
      if (!user) {
        user = new UserModel({ username: generatedUsername, googleId, email });
        await user.save();
        const session = new SessionModel({ username: generatedUsername });
        await session.save();
      }
      return user;
    } catch (err) {
      console.error(err);
      return null;
    }
  } else {
    const db = readDb();
    let userKey = Object.keys(db.users).find(k => db.users[k].googleId === googleId);
    if (!userKey) {
      db.users[generatedUsername] = { password: null, googleId, email, habits: null };
      db.sessions[generatedUsername] = { cycles: [], waterLogged: 0, waterStreak: 0, dailyStreak: 0, lastActiveDate: null, badges: [], checklist: {}, moodLogs: {}, journal: [] };
      writeDb(db);
      userKey = generatedUsername;
    }
    return { username: userKey };
  }
}

async function loginUser(username, password) {
  if (useMongo) {
    try {
      const user = await UserModel.findOne({ username });
      if (!user || user.password !== password) return { success: false, error: "Invalid username or password" };
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    const db = readDb();
    const user = db.users[username];
    if (!user || user.password !== password) return { success: false, error: "Invalid username or password" };
    return { success: true };
  }
}

async function getSession(username) {
  if (useMongo) {
    try {
      let session = await SessionModel.findOne({ username });
      if (!session) {
        session = new SessionModel({ username });
        await session.save();
      }
      return session.toObject();
    } catch (err) {
      console.error(err);
      return {};
    }
  } else {
    const db = readDb();
    if (!db.sessions[username]) {
      db.sessions[username] = { cycles: [], waterLogged: 0, waterStreak: 0, dailyStreak: 0, lastActiveDate: null, badges: [], checklist: {}, moodLogs: {}, journal: [] };
      writeDb(db);
    }
    return db.sessions[username];
  }
}

async function saveSession(username, sessionData) {
  if (useMongo) {
    try {
      await SessionModel.findOneAndUpdate({ username }, sessionData, { upsert: true });
    } catch (err) {
      console.error("Error saving session to Mongo:", err);
    }
  } else {
    const db = readDb();
    db.sessions[username] = sessionData;
    writeDb(db);
  }
}

async function getUserHabits(username) {
  if (useMongo) {
    try {
      // First check session
      const session = await SessionModel.findOne({ username });
      if (session && session.checklist && session.cycles.length > 0) {
        // If we stored habits in session
        const rawObj = session.toObject();
        if (rawObj.habits) return rawObj.habits;
      }
      const user = await UserModel.findOne({ username });
      return user ? user.habits : null;
    } catch (err) {
      return null;
    }
  } else {
    const db = readDb();
    if (db.sessions[username] && db.sessions[username].habits) {
      return db.sessions[username].habits;
    }
    return db.users[username] ? db.users[username].habits : null;
  }
}

async function saveUserHabits(username, habits) {
  if (useMongo) {
    try {
      await UserModel.findOneAndUpdate({ username }, { habits });
      await SessionModel.findOneAndUpdate({ username }, { $set: { habits } });
    } catch (err) {
      console.error("Error saving habits in Mongo:", err);
    }
  } else {
    const db = readDb();
    if (db.sessions[username]) db.sessions[username].habits = habits;
    if (db.users[username]) db.users[username].habits = habits;
    writeDb(db);
  }
}

async function getCommunity() {
  if (useMongo) {
    try {
      const posts = await CommunityModel.find().sort({ _id: -1 });
      return posts.map(p => p.toObject());
    } catch (err) {
      return [];
    }
  } else {
    const db = readDb();
    return db.community || [];
  }
}

async function addCommunityPost(post) {
  if (useMongo) {
    try {
      const newPost = new CommunityModel(post);
      await newPost.save();
    } catch (err) {
      console.error(err);
    }
  } else {
    const db = readDb();
    if (!db.community) db.community = [];
    db.community.unshift(post);
    writeDb(db);
  }
}

async function relateToPost(postId) {
  if (useMongo) {
    try {
      await CommunityModel.findOneAndUpdate({ id: postId }, { $inc: { relates: 1 } });
    } catch (err) {
      console.error(err);
    }
  } else {
    const db = readDb();
    const post = db.community.find(p => p.id === postId);
    if (post) {
      post.relates = (post.relates || 0) + 1;
      writeDb(db);
    }
  }
}

module.exports = {
  connectDb,
  registerUser,
  loginUser,
  findOrCreateGoogleUser,
  getSession,
  saveSession,
  getUserHabits,
  saveUserHabits,
  getCommunity,
  addCommunityPost,
  relateToPost
};
