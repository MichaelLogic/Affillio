let express = require('express');
import HunterCtrl from './hunter.controller';
let controller = new HunterCtrl();
import AuthService from '../../auth/auth.service';
let auth = new AuthService();
let router = express.Router();

router.get('/:id', auth.hasRole('admin'), controller.huntForGoods);

module.exports = router;
