/**
 * Authentication Middleware for Flutter Connector API
 * 
 * This module provides authentication and authorization for API endpoints:
 * - API key-based authentication
 * - Token generation and validation
 * - Secure API endpoint protection
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes, createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger.js';

// Constants
const API_KEY_HEADER = 'x-api-key';
const API_KEY_FILE = path.join(os.homedir(), '.flutter-connector', 'api-key');
const API_KEY_LENGTH = 32; // 256 bits
const MAX_TOKEN_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Store API key
let apiKey: string | null = null;

// Active tokens (token hash -> expiry time)
const activeTokens = new Map<string, number>();

// Token cleanup interval (clear expired tokens every hour)
const TOKEN_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(cleanupExpiredTokens, TOKEN_CLEANUP_INTERVAL);

/**
 * Initialize authentication system
 */
export async function initAuthentication(): Promise<void> {
  try {
    // Get or create API key
    apiKey = await getOrCreateApiKey();
    logger.info('Authentication system initialized');
  } catch (error) {
    logger.error('Failed to initialize authentication system:', error);
    throw error;
  }
}

/**
 * Get or create API key
 */
async function getOrCreateApiKey(): Promise<string> {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(API_KEY_FILE);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (mkdirError) {
      // Ignore if directory already exists
    }
    
    // Try to read existing API key
    try {
      const key = await fs.readFile(API_KEY_FILE, 'utf8');
      if (key && key.trim().length >= API_KEY_LENGTH) {
        logger.info('Using existing API key');
        return key.trim();
      }
    } catch (readError) {
      // File doesn't exist or can't be read, will create new key
    }
    
    // Generate new API key
    const newKey = randomBytes(API_KEY_LENGTH).toString('hex');
    
    // Save API key to file
    await fs.writeFile(API_KEY_FILE, newKey, {
      mode: 0o600, // Read/write for owner only
    });
    
    logger.info('Generated new API key');
    return newKey;
  } catch (error) {
    logger.error('Error getting or creating API key:', error);
    throw error;
  }
}

/**
 * Middleware to authenticate API requests
 */
export function authenticateApiRequest(req: Request, res: Response, next: NextFunction): void {
  // Skip authentication for login and health endpoints
  if (
    req.path === '/api/login' ||
    req.path === '/api/health' ||
    req.path === '/api/health/check'
  ) {
    return next();
  }
  
  // Check for token in header
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    logger.warn(`Authentication failed: No token provided - ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  // Verify token
  const tokenHash = hashToken(token);
  const expiry = activeTokens.get(tokenHash);
  
  if (!expiry) {
    logger.warn(`Authentication failed: Invalid token - ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  
  // Check if token has expired
  if (expiry < Date.now()) {
    // Remove expired token
    activeTokens.delete(tokenHash);
    logger.warn(`Authentication failed: Expired token - ${req.method} ${req.path}`);
    res.status(401).json({ error: 'Token expired' });
    return;
  }
  
  // Token is valid, proceed
  next();
}

/**
 * Generate a new token
 */
export function generateToken(): string {
  // Generate random token
  const token = randomBytes(32).toString('hex');
  
  // Store token hash with expiry time
  const tokenHash = hashToken(token);
  const expiry = Date.now() + MAX_TOKEN_AGE;
  activeTokens.set(tokenHash, expiry);
  
  logger.debug(`Generated new token, expires in ${MAX_TOKEN_AGE / (60 * 60 * 1000)} hours`);
  
  return token;
}

/**
 * Revoke a token
 */
export function revokeToken(token: string): boolean {
  const tokenHash = hashToken(token);
  return activeTokens.delete(tokenHash);
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  let expiredCount = 0;
  
  for (const [hash, expiry] of activeTokens.entries()) {
    if (expiry < now) {
      activeTokens.delete(hash);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    logger.debug(`Cleaned up ${expiredCount} expired tokens`);
  }
}

/**
 * Login handler
 */
export function loginHandler(req: Request, res: Response): void {
  const providedApiKey = req.headers[API_KEY_HEADER] as string;
  
  // Check if API key is configured
  if (!apiKey) {
    logger.error('Authentication failed: API key not configured');
    res.status(500).json({ error: 'Server authentication not configured' });
    return;
  }
  
  // Verify API key
  if (!providedApiKey || providedApiKey !== apiKey) {
    logger.warn('Authentication failed: Invalid API key');
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  
  // Generate token
  const token = generateToken();
  
  // Return token
  res.status(200).json({
    token,
    expires: Date.now() + MAX_TOKEN_AGE,
    expiresIn: MAX_TOKEN_AGE
  });
}

/**
 * Logout handler
 */
export function logoutHandler(req: Request, res: Response): void {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    res.status(400).json({ error: 'No token provided' });
    return;
  }
  
  // Revoke token
  const revoked = revokeToken(token);
  
  if (revoked) {
    res.status(200).json({ message: 'Logged out successfully' });
  } else {
    res.status(400).json({ message: 'Token already expired or invalid' });
  }
} 