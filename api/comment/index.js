const router = require('express').Router();
const controller = require('./comment-controller');
const { isLoggedIn } = require('../util/helpers');

router.post('/getMany', controller.getMany);
router.get('/single/:id', controller.getOne);
router.post('/new', isLoggedIn, controller.create);
router.post('/update', isLoggedIn, controller.edit);
router.delete('/remove/:id', isLoggedIn, controller.remove);

module.exports = router;
