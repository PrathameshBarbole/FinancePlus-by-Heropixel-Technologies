const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class JWTHelper {
    static generateToken(payload) {
        try {
            const token = jwt.sign(payload, JWT_SECRET, {
                expiresIn: JWT_EXPIRES_IN,
                issuer: 'FinancePlus',
                audience: 'FinancePlus-Users'
            });
            return token;
        } catch (error) {
            throw new Error('Error generating JWT token: ' + error.message);
        }
    }

    static verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, {
                issuer: 'FinancePlus',
                audience: 'FinancePlus-Users'
            });
            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            } else {
                throw new Error('Token verification failed: ' + error.message);
            }
        }
    }

    static decodeToken(token) {
        try {
            const decoded = jwt.decode(token, { complete: true });
            return decoded;
        } catch (error) {
            throw new Error('Error decoding token: ' + error.message);
        }
    }

    static getTokenExpiry(token) {
        try {
            const decoded = this.decodeToken(token);
            if (decoded && decoded.payload && decoded.payload.exp) {
                return new Date(decoded.payload.exp * 1000);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    static isTokenExpired(token) {
        try {
            const expiry = this.getTokenExpiry(token);
            if (!expiry) return true;
            return new Date() > expiry;
        } catch (error) {
            return true;
        }
    }

    static refreshToken(token) {
        try {
            const decoded = this.verifyToken(token);
            // Remove the exp, iat, and nbf claims
            const { exp, iat, nbf, ...payload } = decoded;
            return this.generateToken(payload);
        } catch (error) {
            throw new Error('Error refreshing token: ' + error.message);
        }
    }

    static extractUserFromToken(token) {
        try {
            const decoded = this.verifyToken(token);
            return {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                name: decoded.name
            };
        } catch (error) {
            throw new Error('Error extracting user from token: ' + error.message);
        }
    }
}

module.exports = JWTHelper;