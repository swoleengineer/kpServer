const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { acceptableTypes } = require('../util/helpers')

const commentSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    autopopulate: true
  },
  text: String,
  parentId: String,
  parentType: {
    type: String,
    enum: acceptableTypes
  },
  suggested_book: {
    type: Schema.Types.ObjectId,
    ref: 'Book',
    autopopulate: true
  },
  accepted: {
    type: Boolean,
    default: false
  },
  created: {
    type: Date,
    default: new Date()
  },
  votes: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    autopopulate: true
  }]
})

commentSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Comment', commentSchema);
