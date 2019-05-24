const router = require('express').Router();
const controller = require('./question-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.post('/getMany', controller.getByTopic);
router.post('/startCreating', isLoggedIn, controller.create);
router.post('/update', isLoggedIn, controller.edit);
router.delete('/single/:id', isLoggedIn, controller.remove);
router.post('/addTopic/:id/:topicId', isLoggedIn, controller.addTopic);
router.post('/rmTopic/:id/:topicId', isLoggedIn, controller.rmTopic);
router.put('/toggleAgree/:id/:topicId', isLoggedIn, controller.toggleAgree);

module.exports = router;
