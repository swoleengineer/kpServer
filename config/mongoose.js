const mongoose = require('mongoose');

module.exports = config => {
  mongoose.connect(config.db, { dbName: 'keenpages001', useNewUrlParser: true });
  mongoose.Promise = global.Promise;

  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'Keenpages could not connect to the database.'));
  db.once('open', () => console.log('Database connection established successfully.'));
};
