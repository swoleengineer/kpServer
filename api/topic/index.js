const router = require('express').Router();
const controller = require('./topic-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.post('/getMany', controller.getMany);
router.post('/new', isLoggedIn, controller.add);
router.delete('/single/:id', isLoggedIn, controller.remove);


module.exports = router;
