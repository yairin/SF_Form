const jsforce = require('jsforce');
const config = require('./config');

let connPromise = null;

// Uses the OAuth2 username-password flow (scoped to a Connected App) when
// SF_CLIENT_ID/SF_CLIENT_SECRET are set; otherwise falls back to the legacy
// SOAP login() call. Many orgs now reject the legacy call with
// "INSUFFICIENT_ACCESS: ... requires the Use Any API Auth user permission"
// unless that profile permission is explicitly granted — the Connected App
// flow avoids needing it at all.
async function connect() {
  const { loginUrl, username, password, securityToken, clientId, clientSecret } = config.salesforce;
  const conn = clientId && clientSecret
    ? new jsforce.Connection({ oauth2: new jsforce.OAuth2({ loginUrl, clientId, clientSecret }) })
    : new jsforce.Connection({ loginUrl });

  await conn.login(username, password + securityToken);
  return conn;
}

function getConnection() {
  if (!connPromise) {
    connPromise = connect().catch((err) => {
      connPromise = null;
      throw err;
    });
  }
  return connPromise;
}

// Runs fn(conn) against a cached, shared connection. Re-logs in once and retries
// if the session has expired, since this API is expected to stay warm between calls.
async function withConnection(fn) {
  const conn = await getConnection();
  try {
    return await fn(conn);
  } catch (err) {
    if (err.name === 'INVALID_SESSION_ID' || err.errorCode === 'INVALID_SESSION_ID') {
      connPromise = null;
      const freshConn = await getConnection();
      return fn(freshConn);
    }
    throw err;
  }
}

module.exports = { withConnection, connect };
