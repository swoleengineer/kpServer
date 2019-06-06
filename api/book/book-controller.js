const Book = require('./book-model');
const Topic = require('../topic/topic-model');
const Author = require('../author/author-model');
const { handleErr, returnObjectsArray, downloadImg } = require('../util/helpers');
const sendEmail = require('../util/sendEmail');
const { waterfall } = require('async');
const { has } = require('lodash');
const scrapeIt = require('scrape-it');
const Fs = require('fs');
const Path = require('path');
const cloudinary = require('cloudinary');
const base64Img = require('base64-img');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API,
  api_secret: process.env.CLOUDINARY_SECRET
});

const processEnd = res => (err, data) => {
  if (err && typeof err === 'object' && has(err, ['data', 'status', 'message'])) {
    return handleErr(res, err.status, err.message, err.data);
  }
  if (err) {
    console.log('An error occured', err);
    return handleErr(res, 500, 'An error occured', err);
  }
  res.json(data);
};

module.exports = {
  add: (req, res) => {
    const { title, writer, topics, isbn, amazon_link } = req.body;
    const author = writer;
    const { _id: person } = req.user;
    const validate = done => {
      console.log('validating', { title, author, topics, isbn, amazon_link })
      const errors = Object.keys({ title, writer, topics, isbn, amazon_link }).reduce((acc, curr) => [
        ...acc,
        ...(!req.body[curr] ? [curr] : [])
      ], []);
      if (errors.length) {
        return done({
          status: 400,
          message: `Please check the following fields: ${errors.map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(', ')}`,
          data: errors
        })
      }
      return done(null);
    }

    const processAuthor = done => {
      const { id, name } = author;
      if (id && id.length) {
        return done(null, id);
      }
      const newAuthor = new Author({ name });
      newAuthor.save((err, writer) => {
        if (err) {
          return done({
            status: 501,
            message: 'Server error saving new author.',
            data: err
          });
        }
        return done(null, writer._id);
      })
    }

    const checkBook = (writer, done) => Book.findOne({ $or: [{ amazon_link: amazon_link.toLowerCase()}, { isbn }] }).exec().then(
      book => {
        if (!book) {
          return done(null, writer);
        }
        return done({
          status: 400,
          message: 'A book already exists on Keen Pages with this ISBN.',
          data: book
        })
      },
      err => done({
        status: 503,
        message: 'Server error verifying if this book already exists.',
        data: err
      })
    )
    const getData = (writer, done) => {
      scrapeIt(amazon_link, {
        pictureLink: {
          selector: '#imageBlockContainer img',
          attr: 'src'
        },
        amazonTitle: '#productTitle'
      }).then(
        ({ data, response, $, body }) => {
          console.log('finished running scrapeIt', { data });
          const { pictureLink, amazonTitle } = data;
          const fileName = `${Date.now()}${title.trim()}`
          const path = Path.resolve(__dirname, 'files', fileName);
          base64Img.img(pictureLink, path, fileName, (err, filePath) => {
            console.log('finished running base64 library', { filePath, err });
            if (err) {
              return done({
                message: 'Error saving picture for this book on media server',
                status: 501,
                data: err
              });
            }
            cloudinary.uploader.upload(filePath, (result) => {
              if (result.error) {
                console.log('cloudinary error', result.error)
                return done({
                  message: 'Error saving picture for this book on media server.',
                  status: 501,
                  data: result.error
                });
              }
              Fs.unlink(filePath, err => {
                if (err) {
                  return done(null, { pictureResult: result, amazonTitle }, writer);
                }
              });
              console.log('finished uploading file', result);
              return done(null, { pictureResult: result, amazonTitle }, writer)
            })
          })
        },
        (err) => {
          return done({
            message: 'Link error. Please check your pasted amazon link.',
            status: 400,
            data: err
          })
        }
      )
    }
    const processBook = ({ pictureResult, amazonTitle }, writer, done) => {
      const picture = {
        default: true,
        link: pictureResult.secure_url,
        plublic_id: pictureResult.public_id
      };
      console.log('picture details: ', picture)
      const newBook = new Book({
        title,
        author: writer,
        description: amazonTitle,
        topics: topics.map(topic => ({ topic: topic._id, agreed: [person] })),
        isbn: isbn.toLowerCase(),
        amazon_link: amazon_link.toLowerCase(),
        pictures: [picture]
      });
      newBook.save((err, book) => {
        if (err) {
          return done({
            status: 501,
            message: 'Server error saving new book.',
            data: err
          });
        }
        Book.populate(book,
          [{ path: 'author'},
            { path: 'topics.topic'}
          ],
          (error, populatedBook) => {
            if (error) {
              return done(null, book)
            }
            return done(null, populatedBook)
          })
      })
    }

    const notify = (book, done) => sendEmail.bookAdded({ book, user: req.user }).then(
      () => done(null, book),
      () => done(null, book)
    )

    waterfall([
      validate,
      processAuthor,
      checkBook,
      getData,
      processBook,
      notify],
      processEnd(res));
  },
  getOne: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 401, 'Please try your request again.');
    }
    Book.findById(id).populate('author topics.agreed topics.topic').exec().then(
      book => {
        if (!book) {
          return handleErr(res, 404, 'Book not found', book);
        }
        book.views = book.views + 1;
        book.save((err, updated) => {
          if (err) {
            return res.json(book);
          }
          res.json(book);
        });
      },
      err => handleErr(res, 501, 'Server error finding your book.', err)
    );
  },
  getByAuthor: (req, res) => {
    Book.find({ author: req.params.id }).populate('author topics.agreed topics.topic').exec().then(
      books => res.json(returnObjectsArray(books)),
      err => handleErr(res, 500, 'Server error retrieving books for this author.', err)
    )
  },
  getByTopic: (req, res) => {
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

    waterfall([validateRequest, getSimilarTopics, getMainBooks], processEnd(res));
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
  remove: (req, res) => {
    const { id } = req.params;
    if (!id) {
      return handleErr(res, 400, 'Request missing :id property', false);
    }
    Book.findByIdAndRemove(id, (err, response) => {
      if (err) {
        return handleErr(res, 500, '', err);
      }
      res.json(response);
    });
  },
  search: (req, res) => {
    const { text } = req.query;
    if (!text) {
      return handleErr(res, 400, 'You must type something in to perform a search.', false);
    }
    const hit = new RegExp("^" + text, "i")
    const query = {
      $or: [
        { title: hit },
        { description: hit }
      ]
    };
    Book.find(query).populate('author likes topics.agreed ').exec().then(
      books => res.json(returnObjectsArray(books)),
      err => handleErr(res, 501, 'Server error searching for your books', err)
    )
  },
  toggleLike: (req, res) => {
    const { user: { _id: user }, params: { id: book }} = req;
    if (!book) {
      return handleErr(res, 400, 'Your request is missing a book Id', false);
    }
    Book.findById(book).exec().then(
      book => {
        if (!book) {
          return handleErr(res, 404, 'Could not find the book to update.', book);
        }
        book.likes = book.likes.includes(user)
          ? book.likes.filter(x => x !== user)
          : book.likes.concat(user);
        
        book.save((err, response) => {
          if (err) {
            return handleErr(res, 500);
          }
          res.json(response)
        })
      },
      err => handleErr(res, 500)
    )
  },
  addPic: (req, res) => {
    const { params: { id }, body: { picture }} = req;
    Book.findByIdAndUpdate(id,
      { $push: { 'pictures': picture }},
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      })
  },
  rmPic: (req, res) => {
    const { params: { id, pictureId }} = req;
    Book.findByIdAndUpdate(id,
      { $pull: { 'pictures': { _id: pictureId }}},
      { new: true, upsert: true, safe: true },
      (err, response) => {
        if (err) {
          return handleErr(res, 500);
        }
        res.json(response);
      });
  },
  addTopic: (req, res) => {
    Book.findByIdAndUpdate(req.params.id,
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
    Book.findByIdAndUpdate(req.params.id,
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
    Book.findById(id).exec().then(
      book => {
        if (!book) {
          return handleErr(res, 404, 'Could not find the book.', false);
        }
        const { topics } = book;
        book.topics = topics.map(topic => ({
          ...topic,
          agreed: topic._id !== topicId
            ? topic.agreed
            : topic.agreed.includes(_id)
              ? topic.agreed.filter(user => user !== _id)
              : topic.agreed.concat(_id)
        }));
        book.save((error, response) => {
          if (error) {
            return handleErr(res, 'Could not update the topic in this book.', error);
          }
          res.json(response);
        })
      },
      err => handleErr(res, 500)
    )
  }
}
