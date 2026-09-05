const jsforce = require('jsforce');
const config = require('./config');

let connPromise = null;

async function connect() {
  const conn = new jsforce.Connection({ loginUrl: config.salesforce.loginUrl });
  await conn.login(
    config.salesforce.username,
    config.salesforce.password + config.salesforce.securityToken
  );
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

module.exports = { withConnection };
