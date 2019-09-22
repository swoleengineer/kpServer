const { undefinedRoute } = require('../api/util/helpers');

module.exports = app => {
  app.use('/author', require('../api/author'));
  app.use('/book', require('../api/book'));
  app.use('/comment', require('../api/comment'));
  app.use('/question', require('../api/question'));
  app.use('/report', require('../api/report'));
  app.use('/topic', require('../api/topic'));
  app.use('/user', require('../api/user'));
  app.use('/stat', require('../api/stat'));
  app.use('/shelf', require('../api/shelf'));
  app.use('*', undefinedRoute);
}
