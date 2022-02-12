const Problem = require('api-problem');
const config = require('config');
const basicAuth = require('express-basic-auth');
const jwt = require('jsonwebtoken');

const { AuthType } = require('../constants');
const keycloak = require('../keycloak');
const { userService } = require('../../services');

/**
 * Basic Auth configuration object
 * @see {@link https://github.com/LionC/express-basic-auth}
 */
const basicAuthConfig = {
  // Must be a synchronous function
  authorizer: (username, password) => {
    const userMatch = basicAuth.safeCompare(username, config.get('apiAuth.username'));
    const pwMatch = basicAuth.safeCompare(password, config.get('apiAuth.password'));
    return userMatch & pwMatch;
  },
  unauthorizedResponse: () => {
    return new Problem(401, { detail: 'Invalid authorization credentials' });
  }
};

/**
 * @function spkiWrapper
 * Wraps an SPKI key with PEM header and footer
 * @param {string} spki The PEM-encoded Simple public-key infrastructure string
 * @returns {string} The PEM-encoded SPKI with PEM header and footer
 */
const spkiWrapper = (spki) => `-----BEGIN PUBLIC KEY-----\n${spki}\n-----END PUBLIC KEY-----`;

/** Adds a currentUser object to request if there are valid, parseable authentication artifacts */
/**
 * @function currentUser
 * Injects a currentUser object to the request if there exists valid authentication artifacts.
 * Subsequent logic should check `req.currentUser.authType` for authentication method if needed.
 * @param {object} req Express request object
 * @param {object} res Express response object
 * @param {function} next The next callback function
 * @returns {function} Express middleware function
 */
const currentUser = async (req, res, next) => {
  const authorization = req.get('Authorization');
  const currentUser = {
    authType: AuthType.NONE
  };

  if (authorization) {
    // Basic Authorization
    if (config.has('apiAuth') && authorization.toLowerCase().startsWith('basic ')) {
      currentUser.authType = AuthType.BASIC;

      const checkApiAuth = basicAuth(basicAuthConfig);
      return checkApiAuth(req, res, next);
    }

    // OIDC JWT Authorization
    if (config.has('keycloak') && authorization.toLowerCase().startsWith('bearer ')) {
      try {
        currentUser.authType = AuthType.BEARER;

        const bearerToken = authorization.substring(7);
        let isValid = false;

        if (config.has('keycloak.publicKey')) {
          const key = config.get('keycloak.publicKey').startsWith('-----BEGIN')
            ? config.get('keycloak.publicKey')
            : spkiWrapper(config.get('keycloak.publicKey'));
          isValid = jwt.verify(bearerToken, key, {
            issuer: `${config.get('keycloak.serverUrl')}/realms/${config.get('keycloak.realm')}`
          });
        } else {
          isValid = await keycloak.grantManager.validateAccessToken(bearerToken);
        }

        if (isValid) {
          currentUser.tokenPayload = jwt.decode(bearerToken);
          // TODO: Consider db configuration check for no-auth mode?
          await userService.login(currentUser.tokenPayload);
        } else {
          throw new Error('Invalid authorization token');
        }
      } catch (err) {
        return new Problem(403, { detail: err.message }).send(res);
      }
    }
  }

  req.currentUser = Object.freeze(currentUser);
  next();
};

module.exports = {
  basicAuthConfig, currentUser, spkiWrapper
};
