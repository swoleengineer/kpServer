const router = require('express').Router();
const controller = require('./question-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.get('/getAll', controller.getAll);
router.get('/getMany/:topicId', controller.getByTopic);
router.post('/startCreating', isLoggedIn, controller.create);
router.post('/update/:id', isLoggedIn, controller.edit);
router.delete('/single/:id', isLoggedIn, controller.remove);
router.post('/addTopic/:id', isLoggedIn, controller.addTopic);
router.post('/rmTopic/:id/:topicId', isLoggedIn, controller.rmTopic);
router.put('/toggleAgree/:id/:topicId', isLoggedIn, controller.toggleAgree);
router.post('/queryTopicSort', controller.query);
router.post('/search', controller.search);

module.exports = router;
