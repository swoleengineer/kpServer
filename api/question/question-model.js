const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const topicSchema = new Schema({
  topic: {
    type: Schema.Types.ObjectId,
    ref: 'Topic'
  },
  agreed: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  created: {
    type: Date,
    default: new Date()
  }
});

const questionSchema = new Schema({
  text: String,
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  title: String,
  topics: [topicSchema],
  created: {
    type: Date,
    default: new Date()
  }
});

questionSchema.pre('find', function pop(next) {
  this.populate('author topics.topic')
  next();
});

module.exports = mongoose.model('Question', questionSchema);
