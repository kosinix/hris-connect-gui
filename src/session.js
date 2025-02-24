//// Core modules

//// External modules
const session = require('express-session'); // Session engine
const SessionStore = require('express-session-sequelize')(session.Store);

// Use the session middleware
// See options in https://github.com/expressjs/session
module.exports = (database) => {
    return session({
        name: APP_SESSION_NAME,
        store: new SessionStore({
            db: database,
        }),
        secret: APP_SESSION_SECRET,
        cookie: APP_SESSION_COOKIE,
        resave: false,
        saveUninitialized: false
    });
}