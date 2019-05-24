const Sentry = require('@sentry/node');
const { omit } = require('lodash');
const sendEmail = require('./sendEmail');
const jwt = require('jsonwebtoken');
const moment = require('moment');

module.exports = {
  returnObjectsArray: arr => ({ amount: arr.length, data: [...arr] }),
  handleErr: (res, status, message, data) => {
    console.log(status, message, data);
    Sentry.captureException({ status, message, data });
    if (status === 500) return res.status(500).send({
      message: data && data.name === 'MongoError' && data.errmsg.includes('duplicate')
        ? 'Something here is a duplicate of a previous one.'
        : message || 'Server Error with this request',
      data
      });
    return res.status(status).send({ message, data });
  },
  undefinedRoute: (req, res) => res.status(404).send({ message: 'You have reached an undefined route. The KeenPages server does not have this endpoint configured.' }),
  isLoggedIn: (req, res, next) => {
    const message = 'You must be authorized to access this resource.';
    const token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (!token) return res.status(403).send({ message });
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      if (err) return res.status(403).send({ message });
      req.admin = decoded.user.role === 'admin' || decoded.user.role === 'super' ? true : false;
      req.decoded = decoded;
      req.user = decoded.user;
      next();
    });
  },
  getToken: (user) => {
    const payload = {
      iss: 'keenpages.com',
      role: user.role,
      sub: user._id,
      user: omit(user, ['resetPasswordExpires', 'resetPasswordToken', 'role', 'password']),
      exp: moment().add(10, 'days').unix()
    }
    return jwt.sign(payload, process.env.SECRET);
  },
  sendEmail,
  acceptableTypes: ['Book', 'Question', 'Topic']
}
