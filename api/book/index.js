const router = require('express').Router();
const controller = require('./book-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.get('/many/:topicId', controller.getByTopic);
router.get('/all', controller.getAll);
router.post('/addBegin', isLoggedIn, controller.add);
router.post('/addEnd', isLoggedIn, controller.addEnd);
router.post('/edit/:id', isLoggedIn, controller.edit);
router.delete('/delete/:id', isLoggedIn, controller.remove);
router.get('/search', controller.search);
router.put('/toggleLike/:id', isLoggedIn, controller.toggleLike);
router.post('/addPic/:id', isLoggedIn, controller.addPic);
router.delete('/rmPic/:id/:pictureId', isLoggedIn, controller.rmPic);
router.put('toggleAgree/:id/:topicId', isLoggedIn, controller.toggleAgree);

module.exports = router;
