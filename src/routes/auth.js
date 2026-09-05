const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// OAuth2 client_credentials token endpoint ("אימות (Authentication): OAuth כמקובל").
// The AI phone system exchanges its client id/secret for a bearer token here,
// then sends it as `Authorization: Bearer <token>` on POST /api/cases.
router.post('/token', (req, res) => {
  const { grant_type: grantType, client_id: clientId, client_secret: clientSecret } = req.body || {};

  if (grantType !== 'client_credentials') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  if (!config.auth.clientId || clientId !== config.auth.clientId || clientSecret !== config.auth.clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  const token = jwt.sign({ clientId }, config.auth.jwtSecret, { expiresIn: config.auth.tokenTtlSeconds });
  res.json({ access_token: token, token_type: 'Bearer', expires_in: config.auth.tokenTtlSeconds });
});

module.exports = router;
