const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'landing.html'));
});

// STATIC assets
router.get('/landing.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'css', 'landing.css'));
});

router.get('/nav.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'js', 'nav.js'));
});

router.get('/motion.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'js', 'motion.js'));
});

router.get('/before-after.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'js', 'before-after.js'));
});

module.exports = router;
