const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '1d';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

const generateToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
const generateRefreshToken = (payload) => jwt.sign({ ...payload, type: 'refresh' }, SECRET, { expiresIn: REFRESH_EXPIRES });
const generateResetToken = (payload) => jwt.sign({ ...payload, type: 'reset' }, SECRET, { expiresIn: '15m' });
const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { generateToken, generateRefreshToken, generateResetToken, verifyToken };
