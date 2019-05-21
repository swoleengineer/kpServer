const router = require('express').Router();
const controller = require('./author-controller');
const { isLoggedIn } = require('../util/helpers');

router.post('/new', isLoggedIn, controller.add);
router.get('/single/:id', controller.get);
router.post('/many', controller.getMany);
router.post('/update', isLoggedIn, controller.update);
router.delete('/single/:id', isLoggedIn, controller.remove);

module.exports = router;
