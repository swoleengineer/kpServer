const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { acceptableTypes } = require('../util/helpers')

const threadSchema = new Schema({
  parentId: String,
  parentType: {
    type: String,
    enum: acceptableTypes
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    autopopulate: true
  },
  primaryComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    autopopulate: true
  },
  edits: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment',
    autopopulate: true
  }],
  created: {
    type: Date,
    default: new Date()
  }
});

threadSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Thread', threadSchema);
