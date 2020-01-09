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
});

const thirdPartyDataSchema = new Schema({
  provider: String,
  updated: {
    type: Date,
    default: new Date()
  },
  data: Schema.Types.Mixed
})
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
    ref: 'Author'
  },
  authors: [{
    type: Schema.Types.ObjectId,
    ref: 'Author'
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
    ref: 'User'
  },
  thirdPartyData: [thirdPartyDataSchema]
});

bookSchema.pre('find', function pop(next) {
  this.populate('author authors topics.topic');
  next();
})

module.exports = mongoose.model('Book', bookSchema);
