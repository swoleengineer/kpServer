const router = require('express').Router();
const controller = require('./book-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.get('/many/:topicId', controller.getByTopic);
router.get('/all', controller.getAll);
router.post('/addBegin', isLoggedIn, controller.add);
router.post('/edit/:id', isLoggedIn, controller.edit);
router.delete('/delete/:id', isLoggedIn, controller.remove);
router.get('/search', controller.search);
router.put('/toggleLike/:id', isLoggedIn, controller.toggleLike);
router.post('/addPic/:id', isLoggedIn, controller.addPic);
router.delete('/rmPic/:id/:pictureId', isLoggedIn, controller.rmPic);
router.put('/toggleAgree/:id/:topicId', isLoggedIn, controller.toggleAgree);
router.post('/addTopics/:id', isLoggedIn, controller.addTopic);
router.post('/queryTopicSort', controller.query);
router.post('/createFromInternet', controller.createFromGoogle);
module.exports = router;
