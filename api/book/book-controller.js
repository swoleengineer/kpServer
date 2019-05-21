const Book = require('./book-model');
const Topic = require('../topic/topic-model');
const { handleErr, returnObjectsArray } = require('../util/helpers');
const { waterfall } = require('async');
const { has } = require('lodash');

module.exports = {
  addStart: (req, res) => {},
  addEnd: (req, res) => {},
  getOne: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 401, 'Please try your request again.');
    }
    Book.findById(id, (err, book) => {
      if (err) {
        return handleErr(res, 501, 'Server error finding your book.', err);
      }
      if (!book) {
        return handleErr(res, 404, 'Book not found.', false);
      }
      res.json(book);
    });
  },
  getMany: (req, res) => {
    // search books by topic
    const { topicId } = req.params;
    const validateRequest = done => {
      if (!topicId) {
        return done({
          status: 401,
          message: 'Missing a topic, please try your search again.',
          data: false
        })
      }
      done(null);
    }
    const getSimilarTopics = done => Topic.findById(topicId).exec().then(
      topic => {
        if (!topic) {
          return done({
            status: 404,
            message: 'Could not find this topic.',
            data: false
          })
        };
        const { similar } = topic;
        done(null, Array.from(new Set(similar, topicId)));
      },
      data => done({
        status: 501,
        message: 'Server error searching for topic details.',
        data
      })
    );

    const getMainBooks = (similar, done) => {
      Book.find({ 'topics': { topic: { $in: similar }}}).exec().then(
        books => {
          if (!books || !books.length) {
            return done({
              status: 404,
              message: 'There are no books for your topic.',
              data: false
            })
          };
          const results = books.reduce((acc, curr) => {
            const sorted = curr.topics.map(topic => topic.topic).includes(topicId) ? 'main' : 'similar';
            return {
              ...acc,
              [sorted]: [ ...acc[sorted], curr ]
            }
          }, {});
          return done(null, results);
        },
        data => done({
          status: 501,
          message: 'Server error getting your results. Please try again later.',
          data
        })
      )
    }

    waterfall([validateRequest, getSimilarTopics, getMainBooks], (err, books) => {
      if (err && typeof err === 'object' && has(err, ['data', 'status', 'message'])) {
        return handleErr(res, err.status, err.message, err.data);
      }
      if (err) {
        return handleErr(res, 500);
      }
      res.json(books);
    });
  },
  getAll: (req, res) => {
    Book.find().exec().then(
      books => res.json(returnObjectsArray(books)),
      err => handleErr(res, 501, 'Server error retrieving your books', err)
    )
  },
  edit: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 401, 'Please try your request again. Missing parameter (:id)');
    }
    Book.findByIdAndUpdate(id,
      { $set: req.body },
      { safe: true, new: true, upsert: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 501, 'Server error updating this book.', err);
        }
        res.json(response);
      })
  },
}
