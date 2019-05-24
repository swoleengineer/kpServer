const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { acceptableTypes } = require('../util/helpers')

const commentSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  text: String,
  parentId: String,
  parentType: {
    type: String,
    enum: acceptableTypes
  },
  created: {
    type: Date,
    default: new Date()
  }
})

module.exports = mongoose.model('Comment', commentSchema);
