const router = require('express').Router();
const ctrl = require('../controllers/document.controller');
const upload = require('../middlewares/upload.middleware');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.post('/', upload.single('file'), ctrl.upload);
router.delete('/:id', ctrl.remove);

module.exports = router;
