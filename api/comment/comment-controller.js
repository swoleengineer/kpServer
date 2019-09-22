const Comment = require('./comment-model');
const Thread = require('../thread/thread.model');
const { handleErr, returnObjectsArray, acceptableTypes, saveGBook } = require('../util/helpers');
const { pick, omit } = require('lodash');
const { waterfall, each } = require('async');


const processEnd = res => (err, data) => {
  if (err && typeof err === 'object' && has(err, ['data', 'status', 'message'])) {
    console.log('One error occured', err)
    return handleErr(res, err.status, err.message, err.data);
  }
  if (err) {
    console.log('An error occured', err);
    return handleErr(res, 500, 'An error occured', err);
  }
  console.log('sending data to client', data);
  res.json(data);
};

module.exports = {
  getMany: (req, res) => {
    const { parentType, parentId } = req.body;
    if (!parentType || !acceptableTypes.includes(parentType) || !parentId) {
      return handleErr(res, 400, 'Please try your request again. Missing important params', { parentType, parentId });
    }
    const getThread = done => Thread.find({ parentType, parentId }).populate(' primaryComment ').exec().then(
      threads => {
        const existingComments = threads.map((thread) => thread.primaryComment._id);
        const threadMap = threads.reduce((acc, curr) => {
          const { primaryComment: { author } } = curr;
          curr.comments = [];
          return ({ ...acc, [curr._id]: curr })
        }, {});
        return done(null, threadMap, existingComments);
      },
      err => done({
        message: 'Server error retriving comments.',
        data: err,
        status: 501
      })
    )

    const getComments = (threads = {}, existingCommentIds = [], done) => {
      const threadIds = Object.keys(threads)
      Comment.find({
        _id: { $nin: existingCommentIds },
        parentType: { $in: [ parentType, 'Thread'] },
        parentId: { $in: threadIds.concat(parentId) }
      }).populate('author suggested_book').lean().exec().then(
        comments => {
          const mappedThreads = threadIds.map(id => threads[id]);
          if (!comments || !comments.length) {
            return done(null, mappedThreads);
          }
          const processComment = (comment, callBack) => {
            const { parentId, parentType } = comment;
            if (parentType !== 'Thread' || !threads[parentId]) {
              new Thread({ parentId, parentType,
                primaryComment: comment._id,
                author: comment.author._id
              }).save((error, savedThread) => {
                if (error) {
                  callBack({
                    message: 'Server error retrieving threads',
                    status: 501,
                    data: error
                  });
                }
                savedThread.primaryComment = comment;
                threads[savedThread._id] = savedThread;
                callBack();
              })
            }
            threads[parentId].comments.push({
              ...comment,
              author: pick(comment.author, ['profile', 'username'])
            });
            return callback();
          }
          each(comments, processComment, (err) => {
            if (err) {
              return done(err);
            }
            const returnedThreads = Object.keys(threads).map(thread => threads[thread]);
            return done(null, returnedThreads);
          })

        },
        err => done({
          message: 'Server error retrieving comments',
          status: 501,
          data: err
        })
      );
    }

    waterfall([getThread, getComments], (error, threads) => {
      if (error && error.message && typeof error.message === 'string') {
        return handleErr(res, error.status || 500, error.message || 'Could not retrieve comments at this time. Please try again later', error || false);
      }
      return res.json(returnObjectsArray(threads));
    })
  },
  getManyForMany: (req, res) => {
    const { allRequests } = req.body;
    if (!allRequests || !allRequests[0] || allRequests.some(request => !request.parentType || !acceptableTypes.includes(request.parentType) || !request.parentId)) {
      return handleErr(res, 400, 'Please try again, one of these is not formatted correctly.', allRequests);
    }
    Comment.find({
      'parentId': { $in: allRequests.map(request => request.parentId )},
      'parentType': allRequests[0].parentType
    }).populate('author suggested_book').exec().then(
      (comments) => {
        if (!comments || !comments.length) {
          return handleErr(res, 404, 'Comments not found.', false)
        }
        res.json(allRequests.reduce((acc, curr) => ({
          ...acc,
          [curr.parentId]: [...acc[curr.parentId], ...comments.filter(comment => comment.parentId === curr.parentId)]
        }), allRequests.reduce((acc, curr) => ({
          ...acc,
          [curr.parentId]: []
        }), {})))
      },
      err => handleErr(res, 500, 'could not get comments', err)
    )
  },
  getOne: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 400, 'Please try your request again. Missing :id property', false);
    }
    Comment.findById(id).exec().then(
      comment => !comment
        ? handleErr(res, 404, 'Comment not found', false)
        : res.json(comment),
      err => handleErr(res, 500, '', err)
    );
  },
  create: (req, res) => {
    const { author, text, parentId, parentType, created, suggested_book } = req.body;
    if (!author || !text || !parentId || !parentType || !acceptableTypes.includes(parentType)) {
      return handleErr(res, 400, 'Comment could not be accepted. Please try again.', {
        text, parentType
      });
    }

    const createComment = done => {
      const newComment = new Comment({ author, text, parentId, parentType, created: created instanceof Date ? created : new Date() });
      if (suggested_book && !suggested_book.active) {
        saveGBook(suggested_book, req.user, (err, savedBook) => {
          if (err) {
            return done({
              message: 'Could not add this question with your comment',
              status: 501,
              data: err
            })
          }
          newComment.suggested_book = savedBook._id;
          newComment.save((err, comment) => {
            if (err) {
              return done({
                message: 'Could not create your comment.',
                status: 501,
                daya: err
              })
            }
            comment.author = pick(req.user, ['profile', 'username'])
            Comment.populate(comment, [{ path: 'author' }, { path: 'suggested_book' }], (error, result) => {
              if (error) {
                return done(null, comment);
              }
              return done(null, result);
            })
          })
        });
      } else {
        if (suggested_book && suggested_book._id) {
          newComment.suggested_book = suggested_book._id
        }
        newComment.save((err, comment) => {
          if (err) {
            return done({
              message: 'Could not create your comment.',
              status: 501,
              data: err
            });
          }
          comment.author = pick(req.user, ['profile', 'username'])
          Comment.populate(comment, [{ path: 'author' }, { path: 'suggested_book' }], (error, result) => {
            if (error) {
              return done(null, comment);
            }
            return done(null, result);
          })
        })
      }
    }
    
    const processThread = (newComment, done) => {
      if (parentType === 'Thread') {
        return done(null, newComment);
      }
      const newThread = new Thread({ parentId, parentType, primaryComment: newComment._id, author: req.user._id });
      newThread.save((err, savedThread) => {
        if (err) {
          return done({
            message: 'Sorry, could not create your comment. Please try again later.',
            status: 501,
            data: err
          });
        }

        savedThread.primaryComment = newComment;
        return done(null, savedThread);
      })
    }
    waterfall([createComment, processThread], processEnd(res));
  },
  remove: (req, res) => {
    Comment.findByIdAndRemove(req.params.id, (err, response) => {
      if (err) {
        return handleErr(res, 500);
      }
      res.json(response);
    })
  },
  edit: (req, res) => {
    Comment.findByIdAndUpdate(req.params.id,
      { $set: req.body },
      { new: true, safe: true, upsert: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      })
  },
  userUnlikeComment: (req, res) => {
    Comment.findById(req.params.id).exec().then(
      comment => {
        if (!comment) {
          return handleErr(res, 404, 'Comment could not be found. Please try again later', false);
        }
        if (!comment.votes || !Array.isArray(comment.votes)) {
          comment.votes = [];
        }
        for (let i = 0; i < comment.votes.length; i++) {
          if (comment.votes[i] == req.user._id) {
            comment.votes.splice(i,1);
          }
        }
        comment.save((err, updatedComment) => {
          if (err) {
            return handleErr(res, 501, 'Could not update this comment with your like', err);
          }
          Comment.populate(comment, [{ path: 'author'}, { path: 'suggested_book' }], (error, populated) => {
            if (error) {
              res.json(updatedComment);
            }
            res.json(populated);
          })
        })
      },
      err => handleErr(res, 500, 'Server error retrieving your comment to update.', err)
    )
  },
  userLikeComment: (req, res) => Comment.findById(req.params.id).exec().then(
    comment => {
      if (!comment) {
        return handleErr(res, 404, 'Could not find comment to update.', false);
      }
      if (!comment.votes || !Array.isArray(comment.votes)) {
        comment.votes = [];
      }
      for (let i = 0; i < comment.votes.length; i++) {
        if (comment.votes == req.user._id) {
          return handleErr(res, 400, 'You have already liked this comment', comment);
        }
      }
      comment.votes.push(req.user._id);
      comment.save((err, updatedComment) => {
        if (err) {
          return handleErr(res, 501, 'Could not update this comment with your like', err);
        }
        Comment.populate(comment, [{ path: 'author'}, { path: 'suggested_book' }], (error, populated) => {
          if (error) {
            res.json(updatedComment);
          }
          res.json(populated);
        })
      })
    },
    err => handleErr(res, 500, 'Could not load comment to update', err)
  ),
  
}
