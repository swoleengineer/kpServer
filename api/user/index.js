const router = require('express').Router();
const controller = require('./user-controller');
const { isLoggedIn, isAdmin } = require('../util/helpers');

router.get('/userDetails/:id', isLoggedIn, controller.getUserDetails);
router.post('/register', controller.register);
router.post('/auth', controller.authenticate);
router.post('/search', controller.query);
router.post('/autoAuth', controller.autoAuth);
router.post('/forgotPass', controller.forgotPass);
router.post('/resetPassword', controller.resetPassword);
router.post('/changePass/:id', controller.changePass);
router.post('/updatePic/:id', isLoggedIn, controller.changePicture);
router.post('/update/:id', isLoggedIn, isAdmin, controller.update);
router.post('/notifications/:id', isLoggedIn, controller.updateNotifications);
router.post('/engage/saveBook/:list/:id', isLoggedIn, controller.saveBook);
router.post('/engage/rmBook/:list/:id', isLoggedIn, controller.removeBook);
router.post('/editNotifications/:id', isLoggedIn, controller.editNotificationSetting);
module.exports = router;
