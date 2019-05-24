const Comment = require('./comment-model');
const { handleErr, returnObjectsArray, acceptableTypes } = require('../util/helpers');
const { pick } = require('lodash');


module.exports = {
  getMany: (req, res) => {
    const { parentType, parentId } = req.body;
    if (!parentType || !acceptableTypes.includes(parentType) || !parentId) {
      return handleErr(res, 400, 'Please try your request again. Missing important params', { parentType, parentId });
    }
    Comment.find({ parentType, parentId }).populate('author').exec().then(
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
    const { author, text, parentId, parentType } = req.body;
    if (!author || !text || parentId || !parentType || !acceptableTypes.includes(parentType)) {
      return handleErr(res, 400, 'Comment could not be accepted. Please try again.', {
        text, parentType
      });
    }
    const newComment = new Comment({ author, text, parentId, parentType });
    newComment.save((err, comment) => {
      if (err) {
        return handleErr(res, 500, 'Could not create your comment.', err);
      }
      Comment.populate(comment, [{ path: 'author'}], (error, feedback) => {
        if(error) {
          return res.json(comment);
        }
        res.json({
          ...feedback,
          author: pick(feedback, ['profile', 'username'])
        })
      });
    })
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
  }
}
