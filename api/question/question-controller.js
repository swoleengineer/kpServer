const Question = require('./question-model');
const Topic = require('../topic/topic-model');
const { handleErr, returnObjectsArray } = require('../util/helpers');
const { waterfall, each } = require('async');
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
  search: (req, res) => {
    const { text: word, already = [] } = req.body;
    if (!word) {
      return handleErr(res, 400, 'You must type something in to perform a search.', false);
    }
    const text = decodeURI(word);
    const hit = new RegExp("^" + text, "i")
    const keenQuery = Question.find({ $or: [{ title: hit }, { text: hit }], _id: { $nin: already} }).populate('author topics.agreed ').lean();
    keenQuery.exec().then(
      questions => res.json(returnObjectsArray(questions || [])),
      err => handleErr(res, 500, 'Could not search for questions')
    )
  },
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
        for (let i = 0; i < question.topics.length; i++) {
          if (question.topics[i]._id == topicId) {
            console.log('Found the topic')
            if (question.topics[i].agreed.includes(_id)) {
              question.topics[i].agreed.splice(question.topics[i].agreed.indexOf(_id, 1));
            } else {
              question.topics[i].agreed.push(_id)
            }

          }
        }
        question.save((error, response) => {
          if (error) {
            return handleErr(res, 'Could not update the topic in this question.', error);
          }
          Question.populate(question, [{
            path: 'topics.topic'
          }, {
            path: 'author'
          }], (error, populatedQ) => {
            if (error) {
              res.json(response)
            }
            res.json(populatedQ)
          });
        })
      },
      err => handleErr(res, 500)
    )
  },
  addTopic: (req, res) => {
    const getTopics = done => Topic.find({ name: { $in: req.body.topics.map(topic => topic.name )}}).lean().exec().then(
      topics => {
        console.log('fetched topics to see if exists', topics)
        if (!topics || !topics.length) {
          return done(null, {
            existing: [],
            new: req.body.topics
          })
        }
        return done(null, req.body.topics.reduce((acc, curr, i, arr) => {
          const section = topics.map(top => top.name).includes(curr.name)
            ? 'existing'
            : 'new'
          return {
            ...acc,
            [section]: [ ...acc[section],
              section === 'existing'
                ? topics.find(top => top.name === curr.name)
                : curr]
          }
        }, {
          existing: [],
          new: []
        }));
      },
      err => done({ status: 501, message: 'could not add topics' })
    )
    const createNews = (organizedTopics, done) => {
      console.log('will be creating new ones', organizedTopics)
      if (!organizedTopics.new.length) {
        console.log('no new to create')
        return done(null, organizedTopics.existing);
      }
      const createTopic = ({ name, description }, cb) => {
        const newTopx = new Topic({ name, description });
        console.log('creating new topic', { name, description })
        newTopx.save((error, newOne) => {
          if (error) {
            console.log('Error creating', error)
            cb({ status: 501, message: 'Could not create this topic', data: error})
          }
          console.log('succeeded')
          organizedTopics.existing.push(newOne);
          cb();
        });
      }
      each(organizedTopics.new, createTopic, (err) => {
        console.log('finished creating', err)
        if (err) {
          return done({
            status: 501,
            message: 'Could not create and add topics.',
            data: err
          });
        }
        return done(null, organizedTopics.existing);
      })
    }

    const addToQuestion = (tops, done) => Question.findById(req.params.id).exec().then(
      question => {
        if (!question) {
          Promise.reject('Could not get question');
        }
        console.log('adding the topic to the question, got the question')
        const questionTopicIds = question.topics.map(topic => topic.topic);
        const finalTopicsToAdd = tops
          .map(topic => topic._id)
          .filter(topic => !questionTopicIds.includes(topic))
          .map(topic => ({ topic, agreed: [req.user._id] }));
        console.log('Finished filtering out which to add and which not to.')
        if (!finalTopicsToAdd.length) {
          res.json(question);
          return;
        }
        question.topics.push(...finalTopicsToAdd);
        question.save((err, updatedQuestion) => {
          if (err) {
            return done({
              status: 501,
              message: 'Could not update this question to add your topics.',
              data: err
            })
          }
          Question.populate(updatedQuestion, [{ path: 'topics.topic'}, { path: 'author'}], (error, populated) => {
            if (error) {
              return done(null,updatedQuestion)
            }
            console.log('Everything worked fine')
            return done(null, populated)
          })
        })
      },
      err => done({ status: 500, message: 'Server error adding topics to question', data: err})
    );

    waterfall([getTopics, createNews, addToQuestion], processEnd(res))
  },
  query: (req, res) => {
    const { sort = '', topics = undefined, already = []} = req.body;
    if (!sort && (!topics || !topics.length)) {
      return handleErr(res, 400, 'No sort or topics included, try the getAll endpoint instead.', { sort, topics, already });
    }

    const query = Question.aggregate()
      .match({
        'topics': { topic: { $in: topics }},
        '_id': { $nin: already }
      })
      .project({
        'title': 1,
        'author': 1,
        'topics': 1,
        'topicsLength': { '$size': { '$ifNull': ['$topics', []]} },
        'text': 1,
        'created': 1,
      })
      .unwind('$topics')
      .lookup({
        from: 'Author',
        localField: 'author',
        foreignField: '_id',
        as: 'author1'
      })
      .lookup({
        from: 'Topic',
        localField: 'topics.topic',
        foreignField: '_id',
        as: 'topicDocs'
      })
      .group({
        '_id': '$_id',
        'topics': { '$push': '$topics' }
      })
      .sort(sort)
      .limit(50)
      
      query.exec().then(
        books => res.json(returnObjectsArray(books)),
        err => handleErr(res, 500, 'Error retrieving your books', err)
      )
  },
}
