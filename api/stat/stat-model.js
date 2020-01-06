const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bookEntrySchema = new Schema({
  book: {
    type: Schema.Types.ObjectId,
    ref: 'Book',
    autopopulate: { maxDepth: 3 }
  },
  topicWeight: {
    type: Number,
    default: 0
  }
})

const snapShotSchema = new Schema({
  books: [bookEntrySchema],
  created: {
    type: Date,
    default: new Date()
  },
  status: {
    type: Number,
    default: 0
  }
});

const skillSchema = new Schema({
  topic: {
    type: Schema.Types.ObjectId,
    ref: 'Topic',
    autopopulate: { maxDepth: 3 }
  },
  description: String,
  goal: {
    type: Number,
    default: 3
  },
  dueDate: Date,
  currentStatus: {
    type: Number,
    default: 0
  },
  created: {
    type: Date,
    default: new Date()
  },
  snapShots: [snapShotSchema],
  completed: {
    type: Boolean,
    default: false
  },
  updated: {
    type: Date,
    default: new Date()
  }
});

const statSchema = new Schema({
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  figures: [skillSchema],
  updated: {
    type: Date,
    default: new Date()
  }
});

statSchema.plugin(require('mongoose-autopopulate'));

module.exports = mongoose.model('Stat', statSchema);
