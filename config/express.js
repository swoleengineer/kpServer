const { static } = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const cors = require('cors');
const Sentry = require('@sentry/node');
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  debug: process.env.ENVIRONMENT === 'dev'
});



module.exports = (app, config) => {
  app.use(Sentry.Handlers.requestHandler());
  app.use(logger('dev'));
  app.use(bodyParser.json());
  
  app.use(cors());
  app.use(static(`${config.rootPath}/public`));
  app.use((req, res, next) => {
    // const headers = {};
    //   headers["Access-Control-Allow-Origin"] = req.headers.origin || "*";
    //   headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    //   headers["Access-Control-Allow-Credentials"] = false;
    //   headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    //   headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, x-access-token";
    // res.writeHead(200, headers);
    // if (req.method === 'OPTIONS') {
    //   console.log('options call');
      
    //   res.end();
    //   return;
    // }
    if (req.body) {
      console.log('received fr body.', req.body)
    }
    res.setHeader('X-Powered-By', 'SWOLE ENGINEER')
    next();
  });
};
