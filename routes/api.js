const express = require("express");
const router = express.Router();
const apiController = require("../controllers/api");

//router.all('/',apiController.authenticate);

router.post('/public/dhl/guia',apiController.authenticate,apiController.generateGuide);

module.exports = router;