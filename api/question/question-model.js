const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const topicSchema = new Schema({
  topic: {
    type: Schema.Types.ObjectId,
    ref: 'Topic',
    autopopulate: true
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

topicSchema.plugin(require('mongoose-autopopulate'));

const questionSchema = new Schema({
  text: String,
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    autopopulate: true
  },
  title: String,
  topics: [topicSchema],
  created: {
    type: Date,
    default: new Date()
  }
});

questionSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Question', questionSchema);
