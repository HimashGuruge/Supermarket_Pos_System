// models/User.js
// A user is a person who logs in: admin, cashier, or stock manager.
// The password is never stored in plain text — only its hash.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      required: true,
      enum: ["admin", "cashier", "stock"],
      default: "cashier",
    },
  },
  { timestamps: true } // auto adds createdAt and updatedAt
);

// Hash the password BEFORE saving. This runs every time a user is
// created or their password is changed.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare a typed password against the stored hash.
// Returns true or false — controllers use it to check logins.
userSchema.methods.comparePassword = function (typed) {
  return bcrypt.compare(typed, this.password);
};

// Remove the password before sending a user to the frontend,
// so the hash is never visible in the browser.
userSchema.methods.toSafe = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
