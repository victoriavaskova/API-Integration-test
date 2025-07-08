import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user;

  if (!user) {
    return next({ code: 'UNAUTHORIZED', message: 'Authentication is required.' });
  }
  
  // For this project, we'll consider the user 'admin' as the administrator.
  // In a real-world scenario, this would be a role check, e.g., user.role === 'ADMIN'
  if (user.username !== 'admin') {
    return next({ code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
  }

  next();
} 