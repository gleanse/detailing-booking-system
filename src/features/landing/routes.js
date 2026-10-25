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

router.get('/hero-animation.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'css', 'hero-animation.css'));
});

router.get('/nav.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'js', 'nav.js'));
});

router.get('/hero-animation.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'js', 'hero-animation.js'));
});

module.exports = router;
