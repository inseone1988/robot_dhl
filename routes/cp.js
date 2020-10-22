const router = require("express").Router();
const cpController = require("../controllers/cp");

router.get('/:cp',cpController.getCPData);

module.exports = router;