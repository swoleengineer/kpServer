const router = require('express').Router();
const controller = require('./report-controller');
const { isLoggedIn } = require('../util/helpers');

router.post('/new', isLoggedIn, controller.create);
router.delete('/remove/:id', isLoggedIn, controller.remove);
router.post('/query', controller.query);

module.exports = router
