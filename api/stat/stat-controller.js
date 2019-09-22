const Stat = require('./stat-model');
const Book = require('../book/book-model');
const Topic = require('../topic/topic-model');
const User = require('../user/user-model');
const { handleErr } = require('../util/helpers');
const { waterfall } = require('async');
const moment = require('moment');


module.exports = {
  getSingle: (req, res) => {
    const findStat = done => Stat.findOne({ owner: req.params.id }).exec().then(
      STAT => {
        if (!STAT) {
          return done(null, false);
        }
        return done(null, STAT);
      }
    )
    const createStat = (STAT, done) => {
      if (STAT) {
        return done(null, STAT);
      }
      const newStat = new Stat({ owner: req.params.id });
      newStat.save((err, stat) => done(err, stat));
    }
    waterfall([findStat, createStat], (err, stat) => {
      if (err) {
        return handleErr(res, 501, 'Server error retrieving your stat.', err);
      }
      res.json(stat);
    })
  },
  generateStats: (req, res) => {
    const { statId } = req.body;
    const { _id } = req.user;

    const getReadBooks = (done) => {
      User.findById(_id).lean().exec().then(
        ({ readBooks }) => done(null, readBooks),
        err => done(err)
      )
    }

    const getUserStats = (readBooks, done) => {
      Stat.findById(statId).exec().then(
        userStat => {
          const { figures, owner } = userStat;
          if (`${owner}` !== _id && !req.admin) {
            return done({
              status: 403,
              message: 'You are unauthorized to make this request.',
              data: false
            });
          }
          const figurePaths = figures.filter(figure => figure).reduce((acc, curr) => {
            const { updated } = curr;
            const section = moment().isAfter(moment(updated))
              ? 'ready'
              : 'notReady';
            return {
              ...acc,
              [section]: acc[section].concat(curr)
            }
          }, { ready: [], notReady: [] });
          return done(null, { figurePaths, userStat }, readBooks);
        },
        err => done({
          status: 501,
          message: 'Server error retrieving your stats to update.',
          data: err
        })
      )
    }

    const getUserReadBooks = ({ figurePaths: { ready, notReady }, userStat }, readBooks, done) => {
      if (!readBooks.length) {
        return done(null, userStat, notReady);
      }
      const topics = ready.map(skill => skill.topic._id.toString());
      const readyList = ready.map(skill => skill._id.toString());
      Book.find({ _id: { $in: readBooks }, 'topics.topic': { $in: topics }}).lean().exec().then(
        userBooks => {
          const booksBySkill = topics.reduce((acc, curr) => {
            const topicBooks = userBooks.filter(book => {
              const { topics: bookTopics } = book;
              const mappedTopics = bookTopics.map(top => top.topic._id.toString())
              return mappedTopics.includes(curr)
            })
            return {
              ...acc,
              [curr]: topicBooks
            }
          }, {});
          for (let i = 0; i < userStat.figures.length; i++) {
            if (!userStat.figures[i] || userStat.figures[i] === null || userStat.figures[i] === undefined) {
              userStat.figures.splice(i, 1);
            }
            if (userStat.figures[i] && readyList.includes(userStat.figures[i]._id.toString())) {
              const { topic, topic: { _id: topicId }, description, goal } = userStat.figures[i];
              const bookEntries = booksBySkill[topicId.toString()].map(book => {
                const theTopic = book.topics.find(top => top.topic.toString() === topicId.toString()) || { agreed: [] };
                const calculatedAgreed = theTopic.agreed.length / 10;
                const topicWeight = (calculatedAgreed < 1) ? calculatedAgreed : 1;
                return { book: book._id, topicWeight };
              })
              const status = bookEntries.length
              const newSnapShot = {
                books: bookEntries,
                created: new Date(),
                status
              }
              userStat.figures[i].snapShots.push(newSnapShot);
              userStat.figures[i].currentStatus = status;
              userStat.figures[i].updated = new Date();
              userStat.figures[i].completed = userStat.figures[i].goal && userStat.figures[i].goal > 0 ? status >= userStat.figures[i].goal : false;
            }
          }
          userStat.updated = new Date();
          userStat.save((err, updatedStat) => {
            if (err) {
              return done({
                status: 501,
                data: err,
                message: 'Error updating your new stats.'
              })
            }
            Stat.populate(updatedStat, [{ path: 'figures.topic'}], (problem, populatedStat) => {
              if (problem) {
                return done(null, updateStat, notReady);
              }
              return done(null, populatedStat, notReady);
            })
          })
        },
        err => done({
          status: 501,
          message: 'Server error generating your latest stats.',
          data: err
        })
      )
    }

    waterfall([getReadBooks, getUserStats, getUserReadBooks], (err, updatedStat, notReady) => {
      if (err) {
        return handleErr(res, err.status || 501, err.message || 'Could not generate your stats', err.data || err);
      }
      res.json({ updatedStat, notReady });
    })
  },
  addSkill: (req, res) => {
    const { statId, topic, description, goal = 3, dueDate } = req.body;
    const { readBooks } = req.user;
    const validate = done => {
      if (!statId || !topic || !goal) {
        return done({
          message: 'Please try your request again, invalid request.',
          status: 400,
          data: false
        })
      }
      if (!topic.active) {
        const newTopic = new Topic({
          name: topic.name,
          active: true
        });
        newTopic.save((error, updatedTopic) => {
          if (error) {
            return done({
              status: 501,
              message: 'Error creating new topic for your stats.',
              data: error
            });
          }
          return done(null, updatedTopic);
        })
      }
      return done(null, topic);
    }
    const getUserReadBooks = (skill, done) => {
      console.log('Getting user readbooks. What we know so far...', { readBooks })
      if (!readBooks.length) {
        const newSnapShot = {
          books: [],
          created: new Date(),
          status: 0
        }
        const processedSkill = {
          topic: skill._id,
          description,
          goal,
          currentStatus: 0,
          created: new Date(),
          updated: new Date(),
          snapShots: [newSnapShot],
          completed: false
        }
        if (dueDate && typeof new Date(dueDate).getMonth === 'function') {
          processedSkill.dueDate = dueDate;
        } 
        console.log('no books read. so here is the processedSkill', processedSkill);
        return done(null, skill, processedSkill);
      }
      Book.find({ _id: { $in: readBooks }, 'topics.topic': skill._id }).lean().exec().then(
        userBooks => {
          if (!userBooks.length) {
            // user has never read a book with this topic before
            const newSnapShot = {
              books: [],
              created: new Date(),
              status: 0
            }
            const processedSkill = {
              topic: skill._id,
              description,
              goal,
              currentStatus: 0,
              created: new Date(),
              updated: new Date(),
              snapShots: [newSnapShot],
              completed: false
            }
            if (dueDate && typeof new Date(dueDate).getMonth === 'function') {
              processedSkill.dueDate = dueDate;
            } 
            return done(null, skill, processedSkill);
          }
          let status = 0;
          const bookEntries = userBooks.map(book => {
            const theTopic = book.topics.find(top => top.topic === skill._id) || { agreed: [] };
            const calculatedAgreed = theTopic.agreed.length / 10;
            const topicWeight = (calculatedAgreed < 1) ? calculatedAgreed : 1;
            status = status + topicWeight;
            return { book: book._id, topicWeight };
          });
          const newSnapShot = {
            books: bookEntries,
            created: new Date(),
            status
          }
          const processedSkill = {
            topic: skill._id,
            description,
            goal,
            currentStatus: status,
            created: new Date(),
            updated: new Date(),
            snapShots: [newSnapShot],
            completed: goal && goal > 0 ? status >= goal : false
          }
          if (dueDate && typeof new Date(dueDate).getMonth === 'function') {
            processedSkill.dueDate = dueDate;
          } 
          return done(null, skill, processedSkill);
        },
        err => done({
          message: 'Server error retrieving your current books',
          status: 501,
          data: err
        })
      )
    };

    const updateStat = (skill, figure, done) => {
      Stat.findById(statId).exec().then(
        myStat => {
          if (!myStat) {
            return done({
              message: 'Server error updating your stats.',
              data: false,
              status: 404
            });
          }
          myStat.figures.push(figure);
          myStat.updated = new Date();
          myStat.save((err, updatedStat) => {
            if (err) {
              return done(err);
            }
            Stat.populate(updatedStat, [{ path: 'figures.topic'}], (problem, populatedStat) => {
              if (problem) {
                return done(null, updateStat);
              }
              return done(null, populatedStat);
            })
            
          });
        },
        error => {
          return done({
            message: 'Server error updating your stats.',
            data: error,
            status: 501
          })
        }
      )
    }

    waterfall([validate, getUserReadBooks, updateStat], (err, myStatUpdated) => {
      if (err) {
        return handleErr(res, err.status || 500, err.message || 'Could not update your stats.', err.data || err);
      }
      res.json(myStatUpdated);
    })
  },
  editSkill: (req, res) => {
    const { skillId, edits = []} = req.body;
    const { _id } = req.user;
    const {statId} = req.params;
    Stat.findById(statId).exec().then(
      userStat => {
        if (!userStat) {
          return handleErr(res, 404, 'Stats not found. Please try again later.')
        }
        if (userStat.owner.toString() !== _id && !req.admin) {
          return handleErr(res, 403, 'You are not authorized to make this edit.')
        }
        const updateSkill = (figure) => {
          if (figure._id.toString() === skillId) {
            edits.map(({ field, value }) => {
              figure[field] = value;
            })
          }
        }
        userStat.figures.forEach(updateSkill);
        userStat.save((err, updatedStat) => {
          if (err) {
            return handleErr(res, 500);
          }
          Stat.populate(updatedStat, [{ path: 'figures.topic'}], (problem, populatedStat) => {
            if (problem) {
              return res.json(updatedStat)
            }
            return res.json(populatedStat)
          })

        });
      },
      err => handleErr(res, 404, 'User stats not found', false)
    );
  },
  removeSkill: (req, res) => {
    Stat.findByIdAndUpdate(req.params.statId,
      { $pull: { 'figures': { _id: req.params.figureId }}},
      { safe: true, new: true, upsert: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500, 'Could not remove this topic from your stats.');
        }
        res.json(response);
      })
  },
}
