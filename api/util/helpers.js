// const Sentry = require('@sentry/node');
const { omit, flatten, pick } = require('lodash');
const sendEmail = require('./sendEmail');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const axios = require('axios');
const googleBooksUrl = 'https://www.googleapis.com/books/v1/volumes?q=';
const Book = require('../book/book-model');
const Author = require('../author/author-model');
const Topic = require('../topic/topic-model');
const { waterfall, each } = require('async');
const cloudinary = require('cloudinary');
const thirdParty = require('./thirdPartyData');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API,
  api_secret: process.env.CLOUDINARY_SECRET
});

module.exports = {
  returnObjectsArray: arr => ({ amount: arr.length, data: [...arr] }),
  handleErr: (res, status, message, data) => {
    console.log(status, message, data);
    // Sentry.captureException({ status, message, data });
    if (status === 500) return res.status(500).send({
      message: data && data.name === 'MongoError' && data.errmsg.includes('duplicate')
        ? 'Something here is a duplicate of a previous one.'
        : message || 'Server Error with this request',
      data
      });
    return res.status(status).send({ message, data });
  },
  logError: (payload) => null // Sentry.captureException(payload),
  ,undefinedRoute: (req, res) => res.status(404).send({ message: 'You have reached an undefined route. The KeenPages server does not have this endpoint configured.' }),
  isLoggedIn: (req, res, next) => {
    const message = 'You must be authorized to access this resource.';
    const token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (!token) return res.status(403).send({ message });
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      if (err) return res.status(403).send({ message });
      req.admin = decoded.user.role === 'admin' || decoded.user.role === 'super' ? true : false;
      req.decoded = decoded;
      req.user = decoded.user;
      req.sub = decoded.sub
      next();
    });
  },
  checkAuth: (req, res, next) => {
    const token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (!token) return next();
    jwt.verify(token, process.env.SECRET, (err, decoded) => {
      if (err) return next();
      req.admin = decoded.user.role === 'admin' || decoded.user.role === 'super' ? true : false;
      req.decoded = decoded;
      req.user = decoded.user;
      req.sub = decoded.sub
      next();
    });
  },
  isAdmin: (req, res, next) => req.admin ? next() : res.status(403).send({ message: 'You are not authorized to access this resource.' }),
  getToken: (user) => {
    const payload = {
      iss: 'keenpages.com',
      role: user.role,
      sub: user._id,
      user: pick(user, ['profile', 'email', 'username', 'role', 'created']),
      exp: moment().add(10, 'days').unix()
    }
    return jwt.sign(payload, process.env.SECRET);
  },
  downloadImg: (url) => axios({ url, responseType: 'stream' }),
  searchGoogleBooks: (title) => axios.get(`${googleBooksUrl}intitle:${title.split(' ').join('+')}&key=${process.env.GOOGLE_API_KEY_BOOKS}`),
  processGBook: (item, index = undefined) => {
    const { volumeInfo, id, etag } = item;
    const { title, subtitle = '', description = '', authors: writers = [], publisher = '', publishedDate, categories = [], imageLinks, industryIdentifiers = []} = volumeInfo;
    const authors = writers.map((name, _id) => ({ name, _id }));
    const topics = categories.map((name, _id) => ({
      _id,
      agreed: [],
      topic: {
        _id,
        name,
        similar: [],
        active: false
      }
    }));
    const { thumbnail = undefined , smallThumbnail = undefined } = imageLinks || {};
    const picture = {
      link: thumbnail || smallThumbnail || '',
      public_id: '1804'
    };
    const { identifier: isbn10 = '' } = industryIdentifiers.find(x => x.type === 'ISBN_10') || {};
    const { identifier: isbn13 = '' } = industryIdentifiers.find(x => x.type === 'ISBN_13') || {};
    return {
      title,
      subtitle,
      description,
      gId: id,
      gTag: etag,
      publisher,
      publish_date: publishedDate,
      isbn10,
      isbn13,
      likes: [],
      created: new Date(),
      topics,
      active: false,
      pictures: [picture],
      views: 0,
      authors
    }
  },
  getUnique: (arr, prop) => arr.map(e => e[prop]).map((e, i, f) => f.indexOf(e) === i && i).filter(e => arr[e]).map(e => arr[e]),
  saveGBook: (book, user, callback) => {
    const bookPayload = omit(book, ['created', 'likes', 'authors', 'topics', 'pictures', 'active', 'comments', 'reports', 'views']);
    const { authors: scribes = [], topics: cats = [], pictures: pix = []} = book;
    const authors = scribes.map(person => person.name);
    const categories = flatten(cats.map(topic => topic.topic.name));
    const imageLinks = {
      thumbnail: pix.length ? pix[0].link : undefined
    }
    const processAuthor = done => {
      if (!authors.length) {
        return done(null, []);
      }
      Author.find({ name: { $in: authors }}).exec().then(
        writers => {
          if (writers.length) {
            return done(null, writers);
          }
          const newAuthors = [];
          const createNewAuthor = (name, cb) => {
            const newAuthor = new Author({ name });
            newAuthor.save((err, createdAuthor) => {
              if (err) {
                cb({
                  status: 501,
                  message: 'Error creating new author for this book',
                  data: err
                });
                return;
              }
              newAuthors.push(createdAuthor);
              cb();
            })
          }
          each(authors, createNewAuthor, (err) => {
            if (err) {
              return done(err);
            }
            return done(null, newAuthors);
          })
        },
        err => done({
          status: 500,
          message: 'Server error processing authors for this book',
          data: err
        })
      )
    };

    const processTopics = (writers, done) => {
      if (!categories.length) {
        return done(null, [], writers);
      }
      Topic.find({ name: { $in: categories }}).exec().then(
        topics => {
          if (topics.length) {
            return done(null, writers, topics);
          }
          const newTopics = [];
          const createNewTopic = (name, cb) => {
            const newTopic = new Topic({ name, active: true });
            newTopic.save((err, savedTopic) => {
              if (err) {
                cb({
                  status: 501,
                  message: 'Error creating new topics for this book.',
                  data: err
                });
                return;
              }
              newTopics.push(savedTopic);
              cb();
            })
          }
          each(categories, createNewTopic, err => {
            if (err) {
              return done(err);
            }
            done(null, newTopics, writers);
          })
        },
        err => done({
          status: 501,
          message: 'Server error processing topics for this book.',
          data: err
        })
      )
    }

    const processImages = (topics, writers, done) => {
      const { thumbnail = undefined , smallThumbnail = undefined } = imageLinks;
      if (!thumbnail && !smallThumbnail) {
        return done(null, false, topics, writers);
      }
      cloudinary.uploader.upload(thumbnail || smallThumbnail, (result) => {
        if (result.error) {
          console.log('cloudinary error', result.error);
          return done(null, false, topics, writers);
        }
        const image = {
          link: result.secure_url,
          public_id:result.public_id
        };
        return done(null, image, topics, writers);
      })
    }

    const processBook = (image, topics, writers, done) => {
      const newBook = new Book({
        ...bookPayload,
        authors: writers.map(writer => writer._id),
        active: true,
        topics: topics.map(topic => ({
          topic: topic._id,
          agreed: user && user._id ? [ user._id ] : []
        }))
      });
      if (image) {
        newBook.pictures = [ image ];
      }
      newBook.save((err, savedBook) => {
        if (err) {
          return done({
            status: 501,
            message: 'Server error saving this book',
            data: err
          });
        }
        Book.populate(savedBook,[{
          path: 'authors'
        }, {
          path: 'topics.topic'
        }], (error, populatedBook) => {
          if (error) {
            return done(null, savedBook);
          }
          return done(null, populatedBook);
        })
      });
    }

    waterfall([processAuthor, processTopics, processImages, processBook], callback);
  },
  sendEmail,
  thirdParty,
  acceptableTypes: ['Book', 'Question', 'Topic', 'Comment', 'Shelf', 'Thread']
}
