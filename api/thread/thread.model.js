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
    ref: 'User'
  },
  primaryComment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  },
  edits: [{
    type: Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  created: {
    type: Date,
    default: new Date()
  }
});

threadSchema.plugin(require('mongoose-autopopulate'));

threadSchema.pre('find', function pop(next) {
  this.populate('edits author primaryComment');
  next();
});

module.exports = mongoose.model('Thread', threadSchema);
