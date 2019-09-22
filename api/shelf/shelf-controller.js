const Shelf = require('./shelf-model');
const User = require('../user/user-model');
const Book = require('../book/book-model');
const Comment = require('../comment/comment-model');
const { waterfall, each } = require('async');
const { has, omit, flatten } = require('lodash');
const { handleErr, returnObjectsArray, logError } = require('../util/helpers');


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
// add to shelf feed with each edit.
// add ability in comments model for comments to be added to shelves.
// Make sure some actions email notifications out to users.
const minimalShelf = shelf => {
  const { title = '', books = [], icon = '', public, _id } = shelf;
  return { title, books: books.length, icon, public, _id, disabled: true }
}

module.exports = {
  getUserShelf: (req, res) => {
    // should allow you to find shelves by name of shelf and username,
    // if its supposed to be an integrated shelf, create it.
    // if it is not an integrated, and can't be found. return nothing.
    const { username, shelfTitle } = req.body;
    const { _id: currentUserId = undefined } = req.user || { _id: undefined };
    const getUser = done => User.findOne({ username }).populate(' myShelves ').exec().then(
      account => {
        if (!account) {
          return done({
            message: 'Server error retriving shelf details. Please try agin later.',
            status: 501,
            data: false
          });
        }
        const { myShelves = [] } = account;
        if (!myShelves.length && !['readBooks', 'savedBooks'].includes(shelfTitle)) {
          return done({
            message: 'Shelf Not Found.',
            status: 404,
            data: null
          });
        }
        if (['readBooks', 'savedBooks'].includes(shelfTitle)) {
          // its an integrated shelf. we will have to do some work here.
          return done(null, account, { integrated: true, books: account[shelfTitle], public: account.listPublicStatus[shelfTitle] });
        }
        const theShelf = myShelves.find(bookShelf => bookShelf.title === shelfTitle) || undefined;
        return done(!theShelf ? null : {
          message: 'Shelf Not Found.',
          status: 404,
          data: null
        }, account, { integrated: false, shelfId: theShelf._id })
      }
    );

    const getShelf = (userAccount, details, done) => {
      const { integrated = false, shelfId = '', public: intPublic = false, books: intBooks = [] } = details;
      const query = integrated
        ? {
          title: shelfTitle,
          owner: userAccount._id
        }
        : { _id: shelfId }
      Shelf.findOne(query).exec().then(
        shelf => {
          if (!shelf && !integrated) {
            return done({
              message: 'Shelf Not Found.',
              status: 404,
              data: null
            });
          }
          // Finish off logic by merging it with the logic for getshelf.
          const { public: nonIntPublic, followers = [], books: nonIntBooks = [], icon = '' } = shelf || {};
          const public = integrated ? intPublic : nonIntPublic;
          if (!public) {
            if (!currentUserId) {
              return done({
                message: 'This book shelf is not public',
                data: false,
                status: 403
              })
            }
            const followerIds = followers.map(follower => follower._id.toString());
            if (currentUserId && !followerIds.includes(currentUserId) && currentUserId !== userAccount._id) {
              return done({
                message: 'This book shelf is not public',
                data: false,
                status: 403
              });
            }
            return done(null, minimalShelf({ title: shelfTitle, books: integrated ? intBooks : nonIntBooks, icon, public, _id: shelf._id }))
          }
          return done(null, integrated
            ? {
              _id: shelf._id,
              icon,
              created: userAccount.created,
              books: intBooks,
              public,
              followers,
              owner: userAccount,
              integratedType: shelfTitle,
              listType: 'integrated'
            } : shelf);
        },
        err => done({
          message: 'Server error retrieving shelf details. Please try again later.',
          status: 501,
          data: err
        })
      )
    }

    waterfall([getUser, getShelf], processEnd(res));
  },
  getMyShelves: (req, res) => {
    const { _id: owner } = req.user;
    Shelf.find({ owner }).exec().then(
      (shelves = []) => res.json(returnObjectsArray(shelves.map(shelf => {
        const { title, icon, public, owner, integratedType, listType, _id, books = []} = shelf;
        return { title, icon, public, owner, integratedType, listType, id: _id, books: books.length };
      }))),
      error => handleErr(res, 500, 'Could not get your shelves.', error)
    )
  },
  getShelf: (req, res) => {
    /*
      allow retrieving shelves of users (integrated, build it and return it.)
      check to see if shelf is public, otherwise match it with the user requesting.
    */
    const { user = undefined } = req;
    const { id } = req.params;
    
    const pullShelf = done => Shelf.findById(id).exec().then(
      shelf => {
        if (!shelf) {
          return done({
            message: 'Shelf not found.',
            status: 404,
            data: false
          });
        }
        const { owner, public, followers } = shelf;
    
        if (!public) {
          if (!user) {
            return done({
              message: 'This book shelf is not public',
              data: false,
              status: 403
            })
          }
          const followerIds = followers.map(follower => follower._id.toString());
          if (user && !followerIds.includes(user._id) && user._id !== owner._id.toString()) {
            return done({
              message: 'This book shelf is not public',
              data: false,
              status: 403
            });
          }
          if (user && user._id !== owner._id.toString()) {
            return done(null, minimalShelf(shelf));
          }
          return done(null, shelf);
        }
        return done(null, shelf);

      },
      err => done({
        message: 'Server error retrieving shelf.',
        data: err,
        status: 501
      })
    );

    const pullBooks = (shelf, done) => {
      if (shelf.disabled || shelf.listType === 'single') {
        return done(null, shelf);
      }
      const { integratedType, followers, owner, title, icon, _id, listType } = shelf;
      User.findById(owner._id).exec().then(
        userAccount => {
          if (!userAccount) {
            return done({
              message: 'Error retrieving user shelf.',
              status: 501,
              data: error
            });
          }
          const { listPublicStatus: { [integratedType]: publicStatus } = { readBooks: false, savedBooks: false },
            [integratedType]: booksList = [] } = userAccount;
          if (!publicStatus && owner._id.toString() !== userAccount._id.toString()) {
            const followerIds = followers.map(follower => follower._id);
            if (!followerIds.includes(userAccount._id)) {
              return done({
                status: 403,
                message: 'This book shelf is not public.',
                data: false
              });
            }
            return done(null, minimalShelf({ title, books: booksList, icon, public: publicStatus, _id }))
          }
          if (!booksList || !booksList.length) {
            shelf.books = [];
            return done(null, shelf);
          }
          shelf.books = booksList;
          return done(null, shelf);
        },
        error => done({
          message: 'Error retrieving user shelf.',
          status: 501,
          data: error
        })
      )

    }

    const pullBookComments = (shelf, done) => {
      if (!shelf.public || !shelf.books.length) {
        return done(null, shelf);
      }
      const bookIds = shelf.books.map(book => book._id);
      Comment.find({ parentType: 'Book', parentId: { $in: bookIds }}).exec().then(
        comments => {
          shelf.books.forEach(book => {
            const bookComments = comments.filter(({ parentId }) => parentId === book._id);
            book.comments = bookComments;
          });
          return done(null, shelf);
        },
        error => {
          logError({
            message: 'Could not pull comments for books',
            status: 701,
            data: error
          });
          shelf.books.forEach(book => {
            book.comments = [];
          });
          return done(null, shelf);
        }
      )
    }
    const pullShelfComments = (shelf, done) => {
      Comment.find({ parentType: 'Shelf', parentId: shelf._id }).exec().then(
        comments => {
          shelf.comments = comments;
          return done(null, shelf);
        },
        error => {
          logError({
            message: 'Could not pull comments for shelf',
            status: 701,
            data: error
          });
          shelf.comments = [];
          return done(null, shelf);
        }
      )
    }

    waterfall([pullShelf, pullBooks, pullBookComments, pullShelfComments], processEnd(res));
  },
  getShelves: (req, res) => {
    /*
      Search for the user's shelves and shelves the user is subscribed to.
      Check those shelves to know if they are still public before returning..
      otherwise, return an object that indicates the shelf is no longer public. Represent something that allows them to unfollow the shelf on ui
    */
    const { shelfIds = [] } = req.body
    if (!shelfIds.length) {
      res.json(returnObjectsArray(shelfIds));
      return;
    }
    Shelf.find({ _id: { $in: shelfIds }}).exec().then(
      (shelves = []) => res.json(returnObjectsArray(shelves.map(shelf => {
        const { title, icon, public, owner, integratedType, listType, _id, books = []} = shelf;
        return { title, icon, public, owner, integratedType, listType, id: _id, books: books.length };
      }))),
      error => handleErr(res, 500, 'Server error retrieving shelves.', error)
    )
  },
  newShelf: (req, res) => {
    const { title, icon = '', public = false } = req.body;
    const { _id: owner, } = req.user;
    
    const validateAgainstUserShelves = done => User.findById(owner).exec().then(
      account => {
        if (!account) {
          return done({
            message: 'Server error retrieving user account details while adding shelf.',
            status: 501,
            data: null
          })
        }
        const { myShelves } = account;
        for (let i = 0; i < myShelves.length; i++) {
          if (title.toLowerCase().trim() === myShelves[i].toLowerCase().trim()) {
            return done({
              message: 'You already have a shelf with this title.',
              status: 400,
              data: myShelves[i]
            })
          }
        }
        return done(null);
      },
      err => done({
        message: 'Server Error creating this shelf. Please try again later.',
        status: 501,
        data: err
      })
    );

    const createShelf = done => {
      const newUpdate = {
        text: `New shelf created with title: ${title}`,
        eventType: 'newShelf',
        created: new Date()
      }
      const brandNewShelf = new Shelf({ title, icon, owner, updates: [], public });
      brandNewShelf.updates.push(newUpdate);
      brandNewShelf.save((err, createdShelf) => {
        if (err) {
          return done({
            message: 'Server error creating shelf.',
            status: 501,
            data: err
          });
        }
        Shelf.populate(createdShelf, [{ path: 'owner'}], (error, populatedShelf) => {
          if (error) {
            return done(null, createdShelf);
          }
          return done(null, populatedShelf);
        });
      });
    }

    waterfall([validateAgainstUserShelves, createShelf], processEnd(res));
  },
  editShelf: (req, res) => {
    /*
      - Add book
      - remove book
      - make public/private
      - edit name
      - edit/remove icon
    */
    const { edits = [] } = req.body;
    if (!edits.length) {
      return handleErr(res, 400, 'No edits made', { edits });
    }
    const { _id: userId } = req.user;
    const { shelfId } = req.params;
    const affectBooks = (process = 'addBook') => (shelf, bookId) => {
      const booksInShelfById = shelf.books.map(book => book._id.toString());
      if (process === 'addBook') {
        if (booksInShelfById.includes(bookId)) {
          return;
        }
        const newUpdate = {
          text: 'New book added to shelf.',
          created: new Date(),
          eventType: 'newBook'
        }
        shelf.updates.push(newUpdate);
        shelf.books.push(bookId);
        return;
      }
      if (process === 'rmBook') {
        if (!booksInShelfById.includes(bookId)) {
          return;
        }
        for (let i = 0; i < shelf.books.length; i++) {
          if (shelf.books[i]._id.toString() === bookId) {
            const newUpdate = {
              text: 'Book removed from shelf.',
              created: new Date(),
              eventType: 'rmBook'
            }
            shelf.updates.push(newUpdate);
            shelf.books.splice(i, 1);
            return;
          }
        }
      }
      return;
    }
    Shelf.findById(shelfId).exec().then(
      shelf => {
        if (shelf.owner._id.toString() !== userId && !req.admin) {
          return handleErr(res, 403, 'You are not authorized to edit this shelf', false)
        }
        const processEdits = (edit) => {
          switch(edit.type) {
            case 'addBook':
            case 'rmBook':
              affectBooks(edit.type)(shelf, edit.payload.bookId);
              break;
            case 'makePublic':
              shelf.public = true;
              break;
            case 'makePrivate':
              shelf.public = false;
              break;
            case 'editTitle':
              shelf.title = edit.payload.newTitle;
              shelf.updates.push({
                text: `Updated shelf title to ${edit.payload.newTitle}`,
                created: new Date(),
                eventType: 'titleEdit'
              })
              break;
            case 'editIcon':
              shelf.icon = edit.payload.newIcon;
              break;
            default:
              break;
          }
        }
        edits.forEach(processEdits);
        shelf.save((err, updatedShelf) => {
          if (err) {
            return handleErr(res, 500, 'Server error updating this shelf', err)
          }
          Shelf.populate(updatedShelf, [{ path: 'owner' }, { path: 'books' }, { path: 'followers' }], (error, populatedShelf) => {
            if (error) {
              return res.json(updatedShelf)
            }
            return res.json(populatedShelf);
          })
        })
      },
      err => handleErr(res, 501, 'Server error editing this shelf. Please try again later.', err)
    )
  },
  followShelf: (req, res) => {
    const { shelfId } = req.params;
    const { _id: userId } = req.user;
    const addShelfToUser = done => User.findById(userId).exec().then(
      account => {
        if (!account) {
          return done({
            message: 'Server error following shelf. Try refreshing your window.',
            data: false,
            status: 403
          });
        }
        const notFollowing = account.followedShelves.indexOf(shelf => shelf == shelfId) < 0
        if (!notFollowing) {
          return done(null, account)
        }
        account.followedShelves.push(shelfId);
        account.save((err, savedAccount) => {
          if (err) {
            return done({
              message: 'Server error following this shelf. Please try again later.',
              status: 501,
              data: err
            });
          }
          return done(null, savedAccount);
        })
      },
      err => done({
        message: 'Server Error following shelf. Please try again later.',
        data: err,
        status: 501
      })
    )
    const addUserToShelf = (account, done) => {
      Shelf.findById(shelfId).exec().then(
        shelf => {
          if (!shelf) {
            return done({
              message: 'Server error following shelf. Please try again later.',
              status: 501,
              data: false
            });
          }
          const userInList = shelf.followers.indexOf(user => user._id == account._id) > -1;
          if (userInList) {
            return done(null, shelf);
          }
          const { username, profile: { first_name, last_name, picture } } = account;
          
          const newUpdate = {
            text: `${username} started following this shelf.`,
            created: new Date(),
            data: { username, first_name, last_name, picture },
            eventType: 'newFollower'
          }

          shelf.followers.push(account._id);
          shelf.updates.push(newUpdate);
          shelf.save((err, updatedShelf) => {
            if (err) {
              return done({
                message: 'Server error updating shelf.',
                status: 501,
                data: err
              })
            }
            Shelf.populate(updatedShelf, [{ path: 'owner' }, { path: 'books' }, { path: 'followers' }], (error, populatedShelf) => {
              if (error) {
                return done(null, updatedShelf);
              }
              return done(null, populatedShelf);
            })
          })
        },
        err => done({
          message: 'Server error retrieving shelf.',
          status: 501,
          data: err
        })
      )
    }

    waterfall([addShelfToUser, addUserToShelf], processEnd(res));
  },
  unfollowShelf: (req, res) => {
    const { shelfId } = req.params;
    const { _id: userId } = req.user;
    const removeShelfFromUser = done => User.findById(userId).exec().then(
      account => {
        if (!account) {
          return done({
            message: 'Server error unfollowing shelf. Try refreshing your window.',
            data: false,
            status: 403
          });
        }
        const notFollowing = account.followedShelves.indexOf(shelf => shelf == shelfId) < 0
        if (notFollowing) {
          return done(null, account);
        }
        for (let i = 0; i < account.followedShelves.length; i = i + 1) {
          if (account.followedShelves[i] == shelfId) {
            account.followedShelves.splice(i, 1);
            break;
          }
        }
        account.save((err, updatedAccount) => {
          if (err) {
            return done({
              message: 'Server error unfowllowing this shelf. Please try again later.',
              status: 501,
              data: err
            });
          }
          return done(null, updatedAccount);
        })
      },
      err => done({
        message: 'Server error unfollowing shelf. Please try again later.',
        status: 501,
        data: err
      })
    );

    const removeUserFromShelf = (account, done) => {
      Shelf.findById(shelfId).exec().then(
        shelf => {
          if (!shelf) {
            return done({
              message: 'Server error unfollowing shelf. Please try again later.',
              status: 501,
              data: false
            });
          }
          const userInList = shelf.followers.indexOf(user => user._id == account._id) > -1;
          if (!userInList) {
            return done(null, shelf);
          }
          for (let i = 0; i < shelf.followers.length; i++) {
            if (shelf.followers[i]._id === account._id) {
              shelf.followers.splice(i, 1);
              break;
            }
          }
          shelf.save((err, updatedShelf) => {
            if (err) {
              return done({
                message: 'Server error updating shelf.',
                status: 501,
                data: err
              })
            }
            Shelf.populate(updatedShelf, [{ path: 'owner' }, { path: 'books' }, { path: 'followers' }], (error, populatedShelf) => {
              if (error) {
                return done(null, updatedShelf);
              }
              return done(null, populatedShelf);
            })
          })
        },
        err => done({
          message: 'Server error unfollowing shelf. Please try again later.',
          status: 501,
          data: err
        })
      )
    }
    waterfall([removeShelfFromUser, removeUserFromShelf], processEnd(res));
  },
  deleteShelf: (req, res) => {
    const { _id: userId } = req.user;
    const { shelfId } = req.params;
    
    const validatePermission = done => Shelf.findById(shelfId).exec().then(
      shelf => {
        if (!shelf) {
          return done({
            message: 'Server error deleting this shelf.',
            status: 404,
            data: false
          });
        }
        if (shelf.owner !== userId && !req.admin) {
          return done({
            status: 403,
            message: 'You are not authorized to delete this shelf.',
            data: false
          })
        }
        return done(null);
      },
      err => done({
        message: 'Server error deleting this shelf.',
        status: 501,
        data: err
      })
    );

    const removeShelf = done => Shelf.findByIdAndRemove(shelfId, (err, response) => {
      if (err) {
        return done({
          message: 'Server error deleting this shelf. Please try again later.',
          status: 501,
          data: err
        })
      }
      return done(null, response);
    })

    waterfall([validatePermission, removeShelf], processEnd(res));
  },
}
