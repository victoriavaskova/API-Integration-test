// Set environment variables for testing
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // Must be a 32-byte hex string (64 hex characters)
process.env.ENCRYPTION_IV = 'b'.repeat(32);  // Must be a 16-byte hex string (32 hex characters) 