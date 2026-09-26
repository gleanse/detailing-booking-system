const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing.html'));
});

// STATIC assets
router.get('/landing.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'css', 'landing.css'));
});

router.get('/hero-animation.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'css', 'hero-animation.css'));
});

router.get('/nav.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'js', 'nav.js'));
});

router.get('/hero-animation.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'js', 'hero-animation.js'));
});

module.exports = router;
