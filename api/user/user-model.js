const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt-nodejs');

const userSchema = new Schema({
  profile: {
    first_name: String,
    last_name: String,
    picture: {
      public_id: String,
      link: String
    }
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: String,
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  resetPasswordToken: String,
  resetPasswordExpires: {
    type: Date,
    default: Date.now
  },
  notification_new_book: {
    type: Boolean,
    default: true
  },
  notification_new_question: {
    type: Boolean,
    default: true
  },
  notification_book_comment: {
    type: Boolean,
    default: true
  },
  notification_question_comment: {
    type: Boolean,
    default: true
  },
  created: {
    type: Date,
    default: new Date()
  }
});

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

userSchema.methods.generateHash = password => {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
