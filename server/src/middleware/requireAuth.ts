import { NextFunction, Request, Response } from 'express';
import { isAuthenticated } from '../services/githubAuthService';

/**
 * Guards /api routes by verifying the incoming request's session holds a
 * valid (encrypted) GitHub OAuth token. Responds with 401 if absent.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !isAuthenticated(req.session)) {
    res.status(401).json({ message: 'Not authenticated. Please connect your GitHub Enterprise account.' });
    return;
  }
  next();
}
