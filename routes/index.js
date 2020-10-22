var express = require('express');
var router = express.Router();

const {getGuide} = require("../controllers/mydhlgenerate");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get("/guia/:trackingid",getGuide);

module.exports = router;
