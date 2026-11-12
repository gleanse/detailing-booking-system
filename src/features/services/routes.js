const express = require('express');
const router = express.Router();
const path = require('path');
const { getServices } = require('./controller');

// PAGE route serves the HTML
router.get('/', (req, res) => {
  if (req.session?.user?.role === 'customer') {
    return res.redirect('/customer/services');
  }
  res.sendFile(path.join(__dirname, 'services.html'));
});

// LIST route returns services data as JSON
router.get('/list', getServices);

module.exports = router;
