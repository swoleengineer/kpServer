const router = require('express').Router();
const controller = require('./question-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', controller.getOne);
router.post('/getMany', controller.getMany);
router.post('/startCreating', isLoggedIn, controller.createStart);
router.post('/finishCreating', isLoggedIn, controller.createEnd);
router.post('/update', isLoggedIn, controller.edit);
router.delete('/single/:id', isLoggedIn, controller.remove)

module.exports = router;
