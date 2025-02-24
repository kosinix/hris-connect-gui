
//// Core modules

//// External modules
// const JWT = require('jsonwebtoken')
const lodash = require('lodash')

//// Modules


module.exports = {
    requireAuth: async (req, res, next) => {
        try {
            let jwt = lodash.get(req, 'session.jwt')
            if (!jwt) {
                return res.redirect('/login')
            }
           
            next()
        } catch (err) {
            next(err)
        }
    },
    perAppViewVars: async (req, res, next) => {
        const TITLE = req.session?.jwtDecoded?.payload?.scanner?.name
        req.app.locals.APP_URL = APP_URL
        req.app.locals.APP_PORT = APP_PORT
        req.app.locals.APP_TITLE = `HRIS Connect` + ( TITLE ? ` ~ ${TITLE}` : '')
        next()
    },
    perRequestViewVars: async (req, res, next) => {
        try {
            res.locals.user = null

            next();
        } catch (error) {
            next(error);
        }
    },
}