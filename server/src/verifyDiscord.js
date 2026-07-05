const nacl = require('tweetnacl');

/**
 * Discord signs every interaction request with Ed25519.
 * We must verify (signature, timestamp, raw body) against the app's public key
 * BEFORE trusting or parsing the payload. This middleware expects the raw
 * request body to already be attached as `req.rawBody` (a Buffer) — see
 * server.js where express.json({ verify }) captures it.
 */
function verifyDiscordRequest(publicKeyHex) {
  return (req, res, next) => {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    console.log('[verifyDiscord] incoming request', {
      path: req.path,
      hasSignature: Boolean(signature),
      hasTimestamp: Boolean(timestamp),
      bodyLength: req.rawBody?.length || 0,
    });

    if (!signature || !timestamp || !req.rawBody) {
      return res.status(401).send('Missing signature headers');
    }

    const isValid = nacl.sign.detached.verify(
      Buffer.concat([Buffer.from(timestamp), req.rawBody]),
      Buffer.from(signature, 'hex'),
      Buffer.from(publicKeyHex, 'hex')
    );

    console.log('[verifyDiscord] signature verification result', { isValid, path: req.path });

    if (!isValid) {
      return res.status(401).send('Invalid request signature');
    }

    next();
  };
}

module.exports = { verifyDiscordRequest };
