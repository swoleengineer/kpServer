const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pictureSchema = new Schema({
  default: {
    type: Boolean,
    default: false
  },
  link: String,
  public_id: String
})

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
})
const bookSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'Author'
  },
  views: {
    type: Number,
    default: 0
  },
  pictures: [pictureSchema],
  affiliate_link: String,
  active: {
    type: Boolean,
    default: false
  },
  description: String,
  topics: [topicSchema],
  publish_date: {
    type: Date
  },
  isbn: String,
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  created: {
    type: Date,
    default: new Date()
  }
});


module.exports = mongoose.model('Book', bookSchema);
