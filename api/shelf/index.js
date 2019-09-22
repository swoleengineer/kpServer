const router = require('express').Router();
const controller = require('./shelf-controller');
const { isLoggedIn, checkAuth } = require('../util/helpers');


router.get('/single/:id', checkAuth, controller.getShelf);
router.post('/multiple', checkAuth, controller.getShelves);
router.post('/create', isLoggedIn, controller.newShelf);
router.get('/myShelves', isLoggedIn, controller.getMyShelves);
router.post('/newFollower/:shelfId', isLoggedIn, controller.followShelf);
router.post('/rmFollower/:shelfId', isLoggedIn, controller.unfollowShelf);
router.delete('/singleShelf/:shelfId', isLoggedIn, controller.deleteShelf);
router.post('/editShelf/:shelfId', isLoggedIn, controller.editShelf);

module.exports = router;
