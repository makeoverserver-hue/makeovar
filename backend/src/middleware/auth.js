const { verifyAccessToken } = require('../utils/auth');
const AppError = require('../utils/AppError');
const prisma = require('../utils/db');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Not authorized. No token provided.', 401));
    }

    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { branch: true },
    });

    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    if (user.status !== 'ACTIVE' || !user.isActive) {
      return next(new AppError('Account is not active. Contact administrator.', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Not authorized. Invalid token.', 401));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authorized', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

module.exports = { protect, authorize };
