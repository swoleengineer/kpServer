const { static } = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });



module.exports = (app, config) => {
  app.use(Sentry.Handlers.requestHandler());
  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(cors());
  app.use(static(`${config.rootPath}/public`));
  app.use((req, res, next) => {
    if (req.body) {
      console.log('received fr body.', req.body)
    }
    next();
  });
};
