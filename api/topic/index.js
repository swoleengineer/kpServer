const router = require('express').Router();
const controller = require('./topic-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.get('/getAll', controller.getAll);
router.post('/new', isLoggedIn, controller.add);
router.delete('/single/:id', isLoggedIn, controller.remove);
router.get('/search', controller.search);



module.exports = router;
