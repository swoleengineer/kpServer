const Comment = require('./comment-model');
const { handleErr, returnObjectsArray, acceptableTypes, saveGBook } = require('../util/helpers');
const { pick, omit } = require('lodash');


module.exports = {
  getMany: (req, res) => {
    const { parentType, parentId } = req.body;
    if (!parentType || !acceptableTypes.includes(parentType) || !parentId) {
      return handleErr(res, 400, 'Please try your request again. Missing important params', { parentType, parentId });
    }
    Comment.find({ parentType, parentId }).populate('author suggested_book').lean().exec().then(
      comments => {
        if (!comments || !comments.length) {
          return handleErr(res, 404, 'No comments found.');
        }
        res.json(returnObjectsArray(comments.map(comment => ({
          ...comment,
          author: pick(comment.author, ['profile', 'username'])
        }))));
      },
      err => handleErr(res, 500, 'Server error retrieving comments', err)
    );
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
    const newComment = new Comment({ author, text, parentId, parentType, created: created instanceof Date ? created : new Date() });
    if (suggested_book) {
      console.log('received a book. adding to new comment')
      saveGBook(suggested_book, req.user, (err, savedBook) => {
        if (err) {
          return handleErr(res, 500, 'Could not add this book with your comment', err);
        }
        newComment.suggested_book = savedBook._id;
        console.log('created new book', savedBook._id, newComment);
        newComment.save((err, comment) => {
          if (err) {
            return handleErr(res, 500, 'Could not create your comment.', err);
          }
          console.log('finished with comment adding user before sending', req.user)
          comment.author = pick(req.user, ['profile', 'username'])
          Comment.populate(comment, [{ path: 'author' }, { path: 'suggested_book' }], (error, result) => {
            if (error) {
              res.json(comment);
              return;
            }
            return res.json(result)
          })
        })
      });
    } else {
      newComment.save((err, comment) => {
        if (err) {
          return handleErr(res, 500, 'Could not create your comment.', err);
        }
        console.log('finished with comment adding user before sending', req.user)
        comment.author = pick(req.user, ['profile', 'username'])
        Comment.populate(comment, [{ path: 'author' }, { path: 'suggested_book' }], (error, result) => {
          if (error) {
            res.json(comment);
            return;
          }
          return res.json(result)
        })
      })
    }
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
  )
}
