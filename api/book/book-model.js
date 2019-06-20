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
})

topicSchema.plugin(require('mongoose-autopopulate'));

const bookSchema = new Schema({
  gId: String,
  gTag: String,
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String
  },
  publisher: String,
  author: {
    type: Schema.Types.ObjectId,
    ref: 'Author',
    autopopulate: true
  },
  authors: [{
    type: Schema.Types.ObjectId,
    ref: 'Author',
    autopopulate: true
  }],
  views: {
    type: Number,
    default: 0
  },
  pictures: [pictureSchema],
  affiliate_link: String,
  amazon_link: String,
  active: {
    type: Boolean,
    default: false
  },
  description: String,
  topics: [topicSchema],
  publish_date: String,
  isbn10: {
    type: String
  },
  isbn13: {
    type: String
  },
  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
  }],
  created: {
    type: Date,
    default: new Date()
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    autopopulate: true
  }
});

bookSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Book', bookSchema);
