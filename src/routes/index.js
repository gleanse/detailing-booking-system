const express = require('express');

const {
  isAuth,
  isStaff,
  isAdmin,
  isCustomer,
} = require('../shared/middlewares/auth');
const servicesRoutes = require('../features/services/routes');
const authRoutes = require('../features/auth/auth.routes');
const bookingRoutes = require('../features/bookings/routes');
const adminRoutes = require('../features/admin/admin.routes');
const adminPages = require('../features/admin/admin.pages');
const trackRoutes = require('../features/track/track.routes');
const customerRoutes = require('../features/customer/routes');
const staffRoutes = require('../features/staff/routes');
const landingRoutes = require('../features/landing/routes');

// PAGE router serves HTML pages
const pagesRouter = express.Router();
pagesRouter.use('/', landingRoutes);
pagesRouter.use('/services', servicesRoutes);
pagesRouter.use('/auth', authRoutes);
pagesRouter.use('/booking', bookingRoutes);
pagesRouter.use('/admin', isAdmin, adminPages);
pagesRouter.use('/track', trackRoutes);
pagesRouter.use('/customer', customerRoutes);
pagesRouter.use('/staff', staffRoutes);

// API router serves JSON data
const apiRouter = express.Router();
apiRouter.use('/services', servicesRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/booking', bookingRoutes);
apiRouter.use('/admin', isAdmin, adminRoutes);
apiRouter.use('/customer', customerRoutes);
apiRouter.use('/staff', staffRoutes);

module.exports = { apiRouter, pagesRouter };
