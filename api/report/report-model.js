const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { acceptableTypes } = require('../util/helpers')

const reportSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  parentId: String,
  parentType: {
    type: String,
    enum: acceptableTypes
  },
  created: {
    type: Date,
    default: new Date()
  },
  reportType: {
    type: String,
    enum: ['inappropriate', 'spam']
  }
});

module.exports = mongoose.model('Report', reportSchema);
