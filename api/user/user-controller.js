const User = require('./user-model');
const { handleErr, getToken } = require('../util/helpers');
const { resetPass, register } = require('../util/sendEmail');
const crypto = require('crypto');
const { waterfall } = require('async');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { omit } = require('lodash');
const { addToList, MEMBER } = require('../util/mailchimp')

module.exports = {
  register: (req, res) => {
    const { profile, email, username, password } = req.body;
    const validate = done => {
      console.log('About to validate')
      if (!profile || !email || !username || !password) {
        return({
          status: 400,
          message: 'You are missing details. Please try again.',
          data: false
        })
      }
      User.findOne({ $or: [ { email }, { username }]}).exec().then(
        user => {
          if (!user) {
            return done(null);
          }
          console.log(user)
          return done({
            status: 400,
            message: `A user already exists with this ${user.email === email ? 'email address' : 'username'}.`,
            data: false
          }, user);
        },
        err => handleErr(res, 500)
      )
    };

    const createUser = done => {
      console.log('Creating user after validating')
      const newUser = new User({
        profile,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        });
      newUser.password = newUser.generateHash(password);
      newUser.save((err, user) => {
        if (err) {
          return({
            status: 503,
            message: 'Server error creating your user account.',
            data: err
          })
        }
        done(null, user);
      });
    }

    const notify = (user, done) => console.log('sending email') || register(user).then(
      () => done(null, user),
      err => done({
        status: 503,
        message: 'Your account has been created but we could not send a notification to your email address.',
        data: err
      })
    );

    const addToMailChimp = (user, done) => console.log('adding to mailchimp') || addToList(user.email, MEMBER).then(
      () => done(null, user),
      err => done({
        status: 503,
        message: 'Your account has been created but we could not add your email to our list.',
        data: err
      })
    )

    console.log('About to call waterfall')

    waterfall([validate, createUser, notify, addToMailChimp], (err, user) => {
      console.log('registration completed', err, user)
      if (err) {
        return handleErr(res, err.status || 500, err.message || 'Could not create your account', err)
      }
      res.status(201).send({
        user: omit(user, ['resetPasswordExpires', 'resetPasswordToken', 'role', 'password']),
        jwt: getToken(user)
      })
    })
  },
  authenticate: (req, res) => {
    const { password, account } = req.body;
    if (!account) return handleErr(res, 403, 'You must enter an email address or a username');
    User.findOne({ $or: [ { email: account}, { username: account }]}).exec().then(user => {
        if (!user || user === null) return handleErr(res, 404, 'Cannot find user account.');
        if (!user.validPassword(password)) return handleErr(res, 403, 'Incorrect credentials.');
        res.json({
          user: omit(user, ['resetPasswordExpires', 'resetPasswordToken', 'role', 'password']),
          jwt: getToken(user) });
      }, e => handleErr(res, 500, null, e));
  },
  query: (req, res) => {
    const { account } = req.body;
    User.findOne({ $or: [{ username: account }, { email: account }]}).exec().then(
      user => {
        if (!user) {
          return res.status(204).send('User does not exist')
        }
        res.json(user)
      },
      err => handleErr(res, 500)
    )
  },
  autoAuth: (req, res) => {
    const { token } = req.body;
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      if (err) return handleErr(res, 403, 'Cannot be authorized.', err);
      User.findById(decoded.sub).exec().then(user => {
        if (!user || user === null) return handleErr(res, 404, 'Account cannot be found.');
        if (moment(decoded.exp).diff(moment()) > 0) return handleErr(res, 403, 'JWT is expired.');
        res.json({
          user: omit(user, ['resetPasswordExpires', 'resetPasswordToken', 'role', 'password']),
          jwt: token });        
      }, () => handleErr(res, 500));
    });
  },
  forgotPass: (req, res) => {
    const { email, href } = req.body;
    const createToken = done => crypto.randomBytes(20, (err, buf) => done(err, buf.toString('hex')));

    const addToUser = (token, done) => User.findOne({ email }, (err, user) => {
      if (err) return done(err);
      if (!user || user === null) return done('Cannot find an account for that email.');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000;
      user.save((err, updated) => done(
        err ? 'Could not generate token.' : null,
        updated, token
      ));
    });

    const emailUser = (user, token, done) => resetPass(token, href, user)
      .then(() => done(null, user), () => done('Could not send email to user.'));

    waterfall([
      createToken,
      addToUser,
      emailUser
    ], (err, user) => {
      if (err && typeof err === 'string') return handleErr(res, 503, err);
      if (err) return handleErr(res, 500);
      res.json({ email: user.email })
    });
  },
  changePass: (req, res) => User.findById(req.params.id, (err, user) => {
    if (err) return handleErr(res, 500);
    if (req.role !== 'admin' && !user.validPassword(req.body.oldPassword)) {
      return handleErr(res, 403, 'You are not allowed to change this password.');
    }
    user.password = user.generateHash(req.body.password);
    user.save((error, updated) => error ? handleErr(res, 500) : res.json(updated));
  }),
  changePicture: (req, res) => {
    const { public_id, link } = req.body;
    if (!public_id || !link) {
      return handleErr(res, 400, 'Please try your request again.', { public_id, link });
    }
    User.findByIdAndUpdate(req.params.id,
      { $set: { 'profile': {
        'picture': { public_id, link }
      }}},
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      });
  },
  update: (req, res) => {
    User.findByIdAndUpdate(req.params.id,
      { $set: req.body },
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      })
  },
  updateNotifications: (req, res) => {
    const { notificationType, newStatus } = req.body;
    const { id } = req.params
    User.findByIdAndUpdate(id,
      { $set: { [notificationType]: newStatus }},
      { new: true, safe: true, upsert: true },
      (err, response) => {
        if (err) {
          return handleErr(re, 500);
        }
        res.json(response);
      });
  }
}
