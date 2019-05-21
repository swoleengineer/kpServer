const { static } = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const Raven = require('raven');
Raven.config(process.env.RAVEN_DSN).install();


module.exports = (app, config) => {
  app.use(Raven.requestHandler());
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(cors());
  app.use(static(`${config.rootPath}/public`));
  app.use(Raven.errorHandler());
  app.use((req, res, next) => {
    if (req.body) {
      console.log('received fr body.', req.body)
    }
    next();
  });
};
