const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  canEdit: { type: Boolean, default: true },
  expiresAt: { type: Date, default: () => Date.now() + 5 * 60 * 1000 }, // 5 minutes
});

module.exports = mongoose.model("Message", MessageSchema);
