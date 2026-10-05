const prisma = require('../utils/db');
const { generateAccessToken, generateRefreshToken, hashPassword, comparePassword, verifyRefreshToken } = require('../utils/auth');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const sanitizeUser = (user) => {
  const { password, refreshToken, passwordChangedAt, ...cleanUser } = user;
  return cleanUser;
};

const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user || !(await comparePassword(password, user.password))) {
    return next(new AppError('Invalid email or password', 401));
  }
  if (user.status !== 'ACTIVE' || !user.isActive) {
    return next(new AppError('Account is not active. Contact administrator.', 403));
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken, lastLoginAt: new Date(), isActive: true },
  });

  await createAuditLog({ userId: user.id, action: 'LOGIN', entityType: 'USER', entityId: user.id });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, { user: sanitizeUser(user), accessToken }, 'Login successful');
});

const refresh = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) return next(new AppError('No refresh token provided', 401));

  const decoded = verifyRefreshToken(token);
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || user.refreshToken !== token) {
    return next(new AppError('Invalid refresh token', 401));
  }

  const accessToken = generateAccessToken(user);
  sendSuccess(res, { accessToken }, 'Token refreshed');
});

const register = asyncHandler(async (req, res, next) => {
  const { fullName, email, password, role = 'RECEPTIONIST', phone, branchId, clinicId } = req.body;

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return next(new AppError('Email already registered', 409));

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      fullName,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      phone,
      branchId,
      clinicId,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: 'REGISTER',
    entityType: 'USER',
    entityId: user.id,
  });

  sendSuccess(res, { user: sanitizeUser(user) }, 'User registered successfully', 201);
});

const getMe = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { branch: true },
  });
  sendSuccess(res, { user: sanitizeUser(user) }, 'Profile fetched');
});

const updateMe = asyncHandler(async (req, res, next) => {
  const { fullName, phone, avatar, gender } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { fullName, phone, avatar, gender },
  });
  sendSuccess(res, { user: sanitizeUser(user) }, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await comparePassword(currentPassword, user.password))) {
    return next(new AppError('Current password is incorrect', 400));
  }
  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, passwordChangedAt: new Date() },
  });
  await createAuditLog({ userId: user.id, action: 'CHANGE_PASSWORD', entityType: 'USER', entityId: user.id });
  sendSuccess(res, null, 'Password changed successfully');
});

const logout = asyncHandler(async (req, res, next) => {
  if (req.user?.id) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });
    await createAuditLog({ userId: req.user.id, action: 'LOGOUT', entityType: 'USER', entityId: req.user.id });
  }
  res.clearCookie('refreshToken');
  sendSuccess(res, null, 'Logged out successfully');
});

module.exports = { login, refresh, register, getMe, updateMe, changePassword, logout };
