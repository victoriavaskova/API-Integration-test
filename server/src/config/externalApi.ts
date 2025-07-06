import crypto from 'crypto';

export const EXTERNAL_API_CONFIG = {
    baseUrl : process.env.EXTERNAL_API_URL || 'https://bets.tgapps.cloud/api',
    userId  : Number(process.env.EXTERNAL_USER_ID || '1'),
    secretKey: process.env.EXTERNAL_SECRET_KEY,
  
    endpoints: {
      health       : '/health',
      auth         : '/auth',
      balance      : '/balance',
      checkBalance : '/check-balance',
      bet          : '/bet',
      win          : '/win',
    },
  
    rateLimits: {
      global   : '100 requests per 15 minutes',
      auth     : '10 requests per 15 minutes',
      betting  : '20 requests per minute',
    },
  }; 
  

  export function createSignature(
    body: Record<string, unknown> | undefined,
    secretKey: string,
  ): string {
    const payload = JSON.stringify(body ?? {});
    return crypto.createHmac('sha512', secretKey).update(payload).digest('hex');
  }
  

  export function validateExternalApiConfig(): void {
    const missing = ['EXTERNAL_API_URL', 'EXTERNAL_USER_ID', 'EXTERNAL_SECRET_KEY']
      .filter((v) => !process.env[v]);
  
    if (missing.length) {
      throw new Error(`Missing env vars: ${missing.join(', ')}`);
    }
  }
