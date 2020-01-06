const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const topicSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  active: {
    type: Boolean,
    default: false
  },
  similar: [{
    type: Schema.Types.ObjectId,
    ref: 'Topic',
    autopopulate: { maxDepth: 3 }
  }]
});

topicSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Topic', topicSchema);
