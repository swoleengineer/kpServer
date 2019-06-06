const router = require('express').Router();
const controller = require('./user-controller');
const { isLoggedIn } = require('../util/helpers');

router.get('/userDetails/:id', isLoggedIn, controller.getUserDetails);
router.post('/register', controller.register);
router.post('/auth', controller.authenticate);
router.post('/search', controller.query);
router.post('/autoAuth', controller.autoAuth);
router.post('/forgotPass', controller.forgotPass);
router.post('/changePass/:id', controller.changePass);
router.post('/updatePic/:id', isLoggedIn, controller.changePicture);
router.post('/update/:id', isLoggedIn, controller.update);
router.post('/notifications/:id', isLoggedIn, controller.updateNotifications);

module.exports = router;
