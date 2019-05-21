const router = require('express').Router();
const controller = require('./user-controller');
const { isLoggedIn } = require('../util/helpers');

router.post('/register', controller.register);
router.post('/auth', controller.authenticate);
router.post('/autoAuth', controller.autoAuth);
router.post('/forgotPass', controller.forgotPass);
router.post('/changePass', controller.changePass);
router.post('/updatePic', isLoggedIn, controller.changePicture);
router.post('/update', isLoggedIn, controller.update);
router.post('/toggleActive', controller.toggleActive);

module.exports = router;
