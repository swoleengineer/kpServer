const User = require('./user-model');
const Book = require('../book/book-model');
const { handleErr, getToken } = require('../util/helpers');
const { resetPass, register } = require('../util/sendEmail');
const crypto = require('crypto');
const { waterfall } = require('async');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { omit } = require('lodash');
const { addToList, MEMBER } = require('../util/mailchimp')

const userPopulate = 'savedBooks readBooks savedBooks.author readBooks.author';

module.exports = {
  getUserDetails: (req, res) => {
    const { id } = req.params;
    const { role } = req.decoded;
    const { user: { _id }} = req.user;
    if (!id === _id && role !== 'admin') {
      return handleErr(res, 403, 'You are unauthorized to access this resource.', false);
    }
    User.findById(id).populate(userPopulate).exec().then(
      user => {
        if (!user) {
          return handleErr(res, 404, 'User details not found.', user);
        }
        res.json(user);
      },
      err => handleErr(res, 500, 'Server error retrieving the user information.', err)
    )
  },
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
    User.findOne({ $or: [ { email: account}, { username: account }]}).populate(userPopulate).exec().then(user => {
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
      User.findById(decoded.sub).populate(userPopulate).exec().then(user => {
        if (!user || user === null) return handleErr(res, 404, 'Account cannot be found.');
        if (moment(decoded.exp).diff(moment()) > 0) return handleErr(res, 403, 'JWT is expired.');
        res.json({
          user: omit(user, ['resetPasswordExpires', 'resetPasswordToken', 'role', 'password']),
          jwt: token });        
      }, () => handleErr(res, 500));
    });
  },
  forgotPass: (req, res) => {
    const { email } = req.body;
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

    const emailUser = (user, token, done) => resetPass(token, user)
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
  resetPassword: (req, res) => {
    const { password, token } = req.body;
    User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }, (err, user) => {
      if (err) return handleErr(res, 500);
      if (!user || user === null) return handleErr(res, 404, 'Your token is invalid or has expired. Please try requesting another email.');
      user.password = user.generateHash(password);
      user.resetPasswordToken = undefined;
      user.save((error, updated) => error
        ? handleErr(res, 500)
        : res.json({ user: updated, jwt: getToken(updated) })
      );
    });
  },
  changePass: (req, res) => User.findById(req.params.id, (err, user) => {
    if (err) return handleErr(res, 500);
    if (req.role !== 'admin' && !user.validPassword(req.body.oldPassword)) {
      return handleErr(res, 403, 'Please enter a valid previous password.');
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
      { $set: { 'profile.picture': { public_id, link }}},
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        User.populate(response, [{ path: 'savedBooks'}, { path: 'readBooks'}, { path: 'savedBooks.topics.topic'}, { path: 'readBooks.topics.topic' }], (error, populated) => {
          if (error) {
            res.json(response);
            return;
          }
          res.json(populated);
        })
        
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
  },
  removeBook: (req, res) => {
    const { list, id } = req.params;
    const { _id } = req.user;

    const validate = done => {
      if (!['readBooks', 'savedBooks'].includes(list)) {
        return done({
          message: 'Incorrect request. Please include the right list type.',
          status: 400,
          data: { list }
        })
      };
      if (!id) {
        return done({
          message: 'Request missing ID for the book you would like to save.',
          status: 400,
          data: { book: id }
        })
      }
      return done(null);
    };

    const updateBook = done => Book.findById(id).exec().then(
      book => {
        if (!book) {
          Promise.reject({ message: 'book is null?', book });
          return;
        }
        const userLikeIndex = book.likes.indexOf(user => user._id === _id);
        if (userLikeIndex < 0) {
          return done(null, book)
        }
        book.likes.splice(userLikeIndex, 1);
        book.save((err, updatedBook) => {
          if (err) {
            return done({
              message: 'Error updating book for your remove.',
              status: 501,
              data: err
            })
          }
          done(null, updatedBook)
        })
      },
      err => done({
        message: 'Server error updating this book',
        status: 501,
        data: err
      })
    );

    const updateUser = (book, done) => {
      User.findById(_id).exec().then(
        user => {
          if (!user) {
            Promise.reject({
              message: 'Error updating saved books in your account.',
              status: 501,
              data: { user }
            });
            return;
          }
          const bookIndex = user[list].indexOf(id)
          if (bookIndex < 0) {
            return done(null, user, book)
          }
          user[list].splice(bookIndex, 1);
          user.save((err, updatedUser) => {
            if (err) {
              return done({
                message: 'Error updating saved books in your account.',
                status: 501,
                data: err
              });
            }
            return done(null, updatedUser, book)
          })
        },
        err => done({
          mesage: 'Server error retrivieving your book to update.',
          status: 501,
          data: err
        })
      )
    }

    waterfall([validate, updateBook, updateUser], (err, user, book) => {
      if (err) {
        const { status = 500, data = { ...err }, message = 'Could not process your request'} = err;
        return handleErr(res, status, message, data);
      }
      res.json({ user, book });
    })
  },
  saveBook: (req, res) => {
    const { list, id } = req.params;
    const { _id } = req.user;

    const validate = done => {
      if (!['readBooks', 'savedBooks'].includes(list)) {
        return done({
          message: 'Incorrect request. Please include the right list type.',
          status: 400,
          data: { list }
        })
      };
      if (!id) {
        return done({
          message: 'Request missing ID for the book you would like to save.',
          status: 400,
          data: { book: id }
        })
      }
      console.log('finished validating')
      return done(null);
    };

    const updateBook = done => Book.findById(id).exec().then(
      book => {
        if (!book) {
          Promise.reject({ message: 'book is null?', book });
          return;
        }
        if (list === 'readBooks') {
          return done(null, book);
        }
        const userLikeIndex = book.likes.indexOf(user => user._id === _id);
        if (userLikeIndex > 0) {
          return done(null, book)
        }
        book.likes.push(_id);
        console.log('finished with books.')
        book.save((err, updatedBook) => {
          if (err) {
            return done({
              message: 'Error updating book for your save.',
              status: 501,
              data: err
            })
          }
          done(null, updatedBook)
        })
      },
      err => done({
        message: 'Server error updating this book',
        status: 501,
        data: err
      })
    )

    const updateUser = (book, done) => {
      User.findById(_id).exec().then(
        user => {
          console.log('got the user')
          if (user === null) {
            console.log('user is null')
            Promise.reject({
              message: 'Error updating saved books in your account.',
              status: 501,
              data: { user }
            });
            return;
          }
          console.log('completed validation of returned user', user, user[list])
          if (!user[list]) {
            user[list] = []
          }
          const index = user[list].indexOf(id)
          console.log('created index', index)
          if (index > 0) {
            return done(null, user, book)
          }
          console.log('finished checking if book already exists')
          if (list === 'savedBooks' && user.readBooks.indexOf(id) > 0) {
            // trying to add to saved books, but already in read books
            console.log('Trying to add to saved books, but already in read books')
            return done(null, user, book);
          }
          if (list === 'readBooks' && user.savedBooks.indexOf(id) > 0) {
            console.log('Adding to read books, removing from saved books.')
            user.savedBooks.splice(user.savedBooks.indexOf(id), 1);
          }
          console.log('done with all that')
          user[list].push(id);
          console.log('got this far', user)
          user.save((err, updatedUser) => {
            if (err) {
              return done({
                message: 'Error updating saved books in your account.',
                status: 501,
                data: err
              });
            }
            return done(null, updatedUser, book)
          })
        },
        err => done({
          mesage: 'Server error retrivieving your book to update.',
          status: 501,
          data: err
        })
      )
    }

    waterfall([validate, updateBook, updateUser], (err, user, book) => {
      if (err) {
        const { status = 500, data = { ...err }, message = 'Could not process your request'} = err;
        return handleErr(res, status, message, data);
      }
      res.json({ user, book });
    })
  },
  editNotificationSetting: (req, res) => {
    const { type: setting, value } = req.body;

    const availableSettings = ['notification_book_suggested', 'notification_topic_added', 'notification_suggestion_accepted'];
    if (!availableSettings.includes(setting) || typeof value !== 'boolean') {
      return handleErr(res, 400, 'Incorrect notification setting request', false);
    }
    User.findById(req.params.id).exec().then(
      user => {
        user[setting] = value;
        user.save((err, updated) => {
          if (err) {
            return handleErr(res, 502, 'Server error updating your account.', err);
          }
          User.populate(user, [{ path: 'savedBooks'}, { path: 'readBooks'}], (error, populated) => {
            if (error) {
              return res.json(user);
            }
            res.json(populated);
          })
        })
      },
      err => handleErr(res, 500, 'Could not find the account to update.', err)
    )
  }
}
