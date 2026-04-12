import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import authRepository from './auth.repository.js';

class AuthService {
  async registerUser(userData) {
    if (await authRepository.findUserByEmail(userData.email)) {
      throw Object.assign(new Error('Email already in use'), { statusCode: 400 });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await authRepository.createUser({
      ...userData,
      password: hashedPassword
    });

    return this.buildAuthResponse(user);
  }

  async loginUser(email, password) {
    const user = await authRepository.findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    return this.buildAuthResponse(user);
  }

  async createPatientSession({ name, phone, email }) {
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : '';
    const patientEmail = (email || `patient-${normalizedPhone || Date.now()}@eris.local`).toLowerCase();
    const existingUser = await authRepository.findUserByEmail(patientEmail);

    if (existingUser && existingUser.role !== 'PATIENT') {
      throw Object.assign(new Error('This email is already in use by a staff account'), { statusCode: 409 });
    }

    if (existingUser) {
      const updatedUser = await authRepository.updateUser(existingUser.id, {
        name,
        phone: normalizedPhone
      });
      return this.buildAuthResponse(updatedUser);
    }

    const placeholderPassword = await bcrypt.hash(crypto.randomUUID(), 10);
    const patient = await authRepository.createUser({
      name,
      email: patientEmail,
      phone: normalizedPhone,
      password: placeholderPassword,
      role: 'PATIENT'
    });

    return this.buildAuthResponse(patient);
  }

  async resetUserPassword({ userId, email, newPassword }) {
    const user = userId
      ? await authRepository.findUserById(userId)
      : await authRepository.findUserByEmail(email.toLowerCase());

    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await authRepository.updateUser(user.id, {
      password: hashedPassword
    });

    delete updatedUser.password;

    return updatedUser;
  }

  buildAuthResponse(user) {
    const token = jwt.sign(
      { id: user.id, role: user.role, hospitalId: user.hospitalId || null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    delete user.password;

    return { user, token };
  }
}

export default new AuthService();
