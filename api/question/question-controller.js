const Question = require('./question-model');
const Topic = require('../topic/topic-model');
const { handleErr, returnObjectsArray } = require('../util/helpers');
const { waterfall } = require('async');
const { pick } = require('lodash');


const processEnd = res => (err, data) => {
  if (err && typeof err === 'object' && has(err, ['data', 'status', 'message'])) {
    return handleErr(res, err.status, err.message, err.data);
  }
  if (err) {
    return handleErr(res, 500);
  }
  res.json(data);
};

module.exports = {
  getAll: (req, res) => {
    Question.find().populate('author topics.topic').exec().then(
      questions => res.json(returnObjectsArray(questions)),
      err => handleErr(res, 500, '', err)
    )
  },
  create: (req, res) => {
    const { topics, title, text } = req.body;
    const { _id: author } = req.user;
    if (!topics || !topics.length || !title) {
      return handleErr(res, 400, 'Please edit your request. Missing required parameters.');
    };
    const newQuestion = new Question({
      topics: topics.map(topic => ({
        topic: typeof topic === 'string' ? topic : topic._id,
        agreed: [ author ]
      })),
      author, title
    });
    if (text) {
      newQuestion.text = text;
    }
    newQuestion.save((err, question) => {
      if (err) {
        return handleErr(res, 500, 'Could not create your question.', err)
      }
      Question.populate(question, [{
        path: 'author'
      }, {
        path: 'topics.topic'
      }], (error, populated) => {
        if (error) {
          return res.json(question);
        }
        res.json(populated)
      })
    })
  },
  edit: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 400, 'Missing :id property. Please try again.', false);
    }
    Question.findByIdAndUpdate(id,
      { $set: req.body },
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      });
  },
  remove: (req, res) => {
    const { _id: user, role } = req.user;
    const { id } = req.params;
    const validate = done => {
      if (!id) {
        return done({
          status: 400,
          message: 'Your request is missing the :id property. please try again.',
          data: false
        })
      }
      Question.findById(id, (err, question) => {
        if (err) {
          return done({
            status: 501,
            message: 'Server error validating your request prior to deleting this question. The question has not been deleted.',
            data: err
          });
        }
        if (question.author !== user && role !== 'admin') {
          return done({
            status: 403,
            message: 'You are not authorized to make this request.',
            data: false
          });
        }
        done(null);
      })
    };

    const removeQuestion = done => Question.findByIdAndRemove(id, (err, response) => {
      if (err) {
        return done({
          status: 501,
          message: 'Server error deleting this question.',
          data: err
        })
      }
      done(null, response)
    });

    waterfall([validate, removeQuestion], processEnd(res));
  },
  getByTopic: (req, res) => {
    // Search questions by topic
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

    const getMainQuestions = (similar, done) => {
      Question.find({ 'topics': { topic: { $in: similar }}}).exec().then(
        questions => {
          if (!questions || !questions.length) {
            return done({
              status: 404,
              message: 'There are no questions for your topic.',
              data: false
            })
          };
          const results = questions.reduce((acc, curr) => {
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

    waterfall([validateRequest, getSimilarTopics, getMainQuestions], processEnd(res));
  },
  getOne: (req, res) => Question.findById(req.params.id).populate('author topics.topic topics.agreed').lean().exec().then(
    question => {
      if (!question) {
        return handleErr(res, 404, 'Question not found.', false);
      }
      res.json({
        ...question,
        author: pick(question.author, ['profile', 'username']),
        topics: question.topics.map(topic => ({
          ...topic,
          agreed: topic.agreed.map(user => pick(user, ['profile', 'username']))
        }))
      });
    },
    err => handleErr(res, 500)
  ),
  addTopic: (req, res) => {
    Question.findByIdAndUpdate(req.params.id,
      { $push: { 'topics': {
        topic: req.params.topicId,
        agreed: req.user._id
      }}},
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500)
        }
        res.json(response);
      })
  },
  rmTopic: (req, res) => {
    Question.findByIdAndUpdate(req.params.id,
      { $pull: { 'topics': { '_id': req.params.topicId }}},
      { safe: true, upsert: true, new: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      });
  },
  toggleAgree: (req, res) => {
    const { user: { _id }, params: { id, topicId }} = req;
    Question.findById(id).exec().then(
      question => {
        if (!question) {
          return handleErr(res, 404, 'Could not find the question.', false);
        }
        const { topics } = question;
        question.topics = topics.map(topic => ({
          ...topic,
          agreed: topic._id !== topicId
            ? topic.agreed
            : topic.agreed.includes(_id)
              ? topic.agreed.filter(user => user !== _id)
              : topic.agreed.concat(_id)
        }));
        question.save((error, response) => {
          if (error) {
            return handleErr(res, 'Could not update the topic in this question.', error);
          }
          res.json(response);
        })
      },
      err => handleErr(res, 500)
    )
  }
}
