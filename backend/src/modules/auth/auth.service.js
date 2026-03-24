const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRepository = require('./auth.repository');

class AuthService {
  async registerUser(userData) {
    // Check if user exists
    const existingUser = await authRepository.findUserByEmail(userData.email);
    if (existingUser) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create User
    const user = await authRepository.createUser({
      ...userData,
      password: hashedPassword
    });

    // Generate Token
    const token = this.generateToken(user.id, user.role);

    // Remove password from response
    delete user.password;

    return { user, token };
  }

  async loginUser(email, password) {
    // Find User
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    // Generate Token
    const token = this.generateToken(user.id, user.role);

    delete user.password;

    return { user, token };
  }

  generateToken(id, role) {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
  }
}

module.exports = new AuthService();
