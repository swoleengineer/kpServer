const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const socialSchema = new Schema({
  site: {
    type: String,
    enum: ['ig', 'tw', 'fb', 'li']
  },
  url: String
})

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
  },
  presence: [socialSchema]
});

module.exports = mongoose.model('Author', authorSchema);
