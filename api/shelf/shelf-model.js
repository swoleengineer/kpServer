const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const updatesSchema = new Schema({
  text: String,
  created: {
    type: Date,
    default: new Date()
  },
  data: Schema.Types.Mixed,
  eventType: {
    type: String,
    enum: ['newBook', 'rmBook', 'newFollower', 'newShelf', 'titleEdit'],
    default: 'newBook'
  }
});

const shelfSchema = new Schema({
  title: String,
  icon: String,
  created: { 
    type: Date,
    default: new Date()
  },
  books: [{
    type: Schema.Types.ObjectId,
    ref: 'Book'
  }],
  public: {
    type: Boolean,
    default: false
  },
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  integratedType: {
    type: String,
    enum: ['readBooks', 'savedBooks'],
    default: 'readBooks'
  },
  listType: {
    type: String,
    enum: ['integrated', 'single'],
    default: 'single'
  },
  updates: [updatesSchema]
});

shelfSchema.pre('find', function pop(next) {
  this.populate('owner followers');
  next();
});

module.exports = mongoose.model('Shelf', shelfSchema);
