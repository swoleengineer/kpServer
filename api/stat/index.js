const router = require('express').Router();
const controller = require('./stat-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/single/:id', isLoggedIn, controller.getSingle);
router.post('/addSkill', isLoggedIn, controller.addSkill);
router.post('/generateStats', isLoggedIn, controller.generateStats);
router.post('/editSkill/:statId', isLoggedIn, controller.editSkill);
router.post('/removeSkill/:statId/:figureId', isLoggedIn, controller.removeSkill);


module.exports = router;
