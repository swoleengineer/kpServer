const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const authorSchema = new Schema({
  name: String,
  website: String,
  picture: {
    link: String,
    public_id: String
  },
  created: {
    type: Date,
    default: new Date()
  }
});

module.exports = mongoose.model('Author', authorSchema);
