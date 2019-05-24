const Author = require('./author-model');
const { handleErr, returnObjectsArray } = require('../util/helpers');

module.exports = {
  get: (req, res) => {
    const { id } = req.params
    if (!id) {
      return handleErr(res, 400, 'Missing author Id. Please try again.');
    }
    Author.findById(id).exec().then(
      author => !author
        ? handleErr(res, 404, 'Author details could not be found.')
        : res.json(author),
      data => handleErr(res, 501, 'Server error retrieving author details.', data)
    );
  },
  getMany: (req, res) => {
    const { name } = req.query;
    if (!name) {
      return handleErr(res, 400, 'Please enter a name.', name);
    }
    const query = new RegExp("^" + name, "i");
    Author.find({ name: query }).exec().then(
      authors => res.json(returnObjectsArray(authors)),
      err => handleErr(res, 500, '', err)
    );
  },
  add: (req, res) => {
    const { name, website } = req.body;
    if (!name) {
      return handleErr(res, 400, 'Please enter a name for the author.', false);
    }
    const newAuthor = new Author({ name });
    if (website) {
      newAuthor.website = website;
    }
    newAuthor.save((err, author) => {
      if (err) {
        return handleErr(res, 501, 'Server error adding this author.', err);
      }
      res.json(author);
    })
  },
  update: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 400, 'Please try your request again. Missing :id property.', false);
    }
    Author.findByIdAndUpdate(id,
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
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 400, 'Missing :id property. Please try your query again.', false);
    }
    Author.findByIdAndRemove(id, (err, response) => {
      if (err) {
        return handleErr(res, 500);
      }
      res.json(response);
    });
  }
}
