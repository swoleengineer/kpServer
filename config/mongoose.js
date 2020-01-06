const mongoose = require('mongoose');

module.exports = config => {
  mongoose.set('useNewUrlParser', true);
  mongoose.set('useFindAndModify', false);
  mongoose.set('useCreateIndex', true);
  mongoose.set('useUnifiedTopology', true);
  mongoose.connect(config.db, { dbName: 'keenpages001', useNewUrlParser: true, useCreateIndex: true });
  mongoose.Promise = global.Promise;

  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'Keenpages could not connect to the database.'));
  db.once('open', () => console.log('Database connection established successfully.'));
};
