const router = require('express').Router();
const controller = require('./book-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.get('/many/:topicId', controller.getMany);
router.get('/all', controller.getAll);
router.post('/addBegin', isLoggedIn, controller.addStart);
router.post('/addEnd', isLoggedIn, controller.addEnd);
router.post('/edit/:id', isLoggedIn, controller.edit);

module.exports = router;
