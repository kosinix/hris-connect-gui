//// Core modules
const { watchFile, writeFileSync, readFileSync, existsSync } = require('fs')
const fsAsync = require('fs').promises
const path = require('path')
const process = require('process')

//// External modules
const express = require('express')
const flash = require('kisapmata')
const jwtLib = require('jsonwebtoken')
const moment = require('moment')
const lodashGroupBy = require('lodash.groupby')

//// Modules
const middlewares = require('./middlewares')

// Routes
let router = express.Router()



router.get('/login', async (req, res, next) => {
    try {

        let data = {
            flash: flash.get(req, 'login')
        }
        res.render('login.html', data)
    } catch (err) {
        next(err)
    }
})
router.post('/login', async (req, res, next) => {
    try {
        // console.log(req.body)

        const API_END_POINT = req.body.endPoint
        let postData = {
            username: req.body.username,
            password: req.body.password
        }
        let response = await fetch(`${API_END_POINT}/login`, {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: {
                'Content-Type': 'application/json',
            }
        })
        if (!response.ok) {
            throw new Error(await response.text())
        }
        let jwt = await response.text()
        let jwtDecoded = jwtLib.decode(jwt)
        let jwtExpDate = moment.unix(jwtDecoded?.exp)
        let isExpired = moment().isSameOrAfter(jwtExpDate)
        // console.log(jwtDecoded)
        // console.log(jwtExpDate)
        // console.log(isExpired)

        // Save jwt to session
        req.session.jwt = jwt
        req.session.jwtDecoded = jwtDecoded
        req.session.apiEndPoint = API_END_POINT
        res.redirect('/')
    } catch (err) {
        console.error(err)
        if (err.message.length > 50) {
            err.message = 'Something went wrong.'
        }
        flash.error(req, 'login', err.message);
        return res.redirect('/login');
    }
})

router.get('/logout', async (req, res, next) => {
    try {

        if (req.session?.jwt) req.session.jwt = null
        if (req.session?.jwtDecoded) req.session.jwtDecoded = null
        if (req.session?.apiEndPoint) req.session.apiEndPoint = null
        if (req.session?.acsrf) req.session.acsrf = null
        if (req.session?.flash) req.session.flash = null
        res.clearCookie(APP_SESSION_NAME, APP_SESSION_COOKIE);

        res.redirect('/login');
    } catch (err) {
        next(err)
    }
})

router.get('/', middlewares.requireAuth, async (req, res, next) => {
    try {

        res.render('home.html')
    } catch (err) {
        next(err)
    }
})
router.post('/sync', middlewares.requireAuth, async (req, res, next) => {
    try {
        // await new Promise(resolve => setTimeout(resolve, 2000)) // Rate limit 
        console.log(req.body)
        const DATE_TO_PROCESS = (req.body?.date) ? moment(req.body?.date) : moment()
        console.log(DATE_TO_PROCESS)

        let file = ''
        try {
            let fileHandle = await fsAsync.open(BIOMETRIC_FILE, 'wx')
            file = fileHandle.toString('utf-8').trim()

        } catch (_err) {
            let fileHandle = readFileSync(BIOMETRIC_FILE)
            file = fileHandle.toString('utf-8').trim()

        }

        let rows = file.split("\n")?.map(r => {
            return r.split(", ")?.map(c => c?.trim())
        })

        // Today only
        rows = rows.filter(r => {
            return DATE_TO_PROCESS.clone().format('YYYY-MM-DD') === r.at(1)
        })


        // Check logs.db if the entry is already in it
        let promises = rows.map(r => {
            return req.app.locals.db.models.Log.findOne({
                where: {
                    bid: r.at(0),
                    date: r.at(1),
                    time: r.at(2),
                }
            })
        })
        let results = await Promise.all(promises)

        // Remove it from the rows to be send to the server
        rows = rows.filter((r, i) => {
            return (results[i]) ? false : true
        })

        // Sort from earliest log
        rows.sort(function (a, b) {
            let dateTimeA = moment(`${a[1]} ${a[2]}`, 'YYYY-MM-DD hh:mm:ss A', true)
            let dateTimeB = moment(`${b[1]} ${b[2]}`, 'YYYY-MM-DD hh:mm:ss A', true)
            if (dateTimeA.isBefore(dateTimeB)) {
                return -1;
            }
            if (dateTimeA.isAfter(dateTimeB)) {
                return 1;
            }
            return 0;
        });

        // Sort from smallest BID
        rows.sort(function (a, b) {
            try {
                a = parseInt(a.at(0))
                b = parseInt(b.at(0))
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;

            } catch (_) {
                return 0;

            }
        })

        // Group by date
        rows = lodashGroupBy(rows, (row) => row[1])
        // console.log(rows)
        // Structure after groupBy
        /**
         * {
                '2024-09-05': [
                    [ '320', '2024-09-05', '08:16:49 AM' ],
                    [ '209', '2024-09-05', '08:17:07 AM' ],
                    [ '284', '2024-09-05', '08:17:33 AM' ],
                    [ '384', '2024-09-05', '08:19:50 AM' ],
                    [ '26', '2024-09-05', '08:19:56 AM' ],
                    [ '138', '2024-09-05', '08:21:09 AM' ],
                    [ '251', '2024-09-05', '08:21:32 AM' ]
                ]
            }
        **/

        let jwt = req.session.jwt
        let apiEndPoint = req.session.apiEndPoint

        let endPoint = `${apiEndPoint}/app/biometric/scans`
        if (endPoint) {
            endPoint = `${apiEndPoint}/app/biometric/scans?date=${DATE_TO_PROCESS.format('YYYY-MM-DD')}`
        }
        response = await fetch(endPoint, {
            method: 'POST',
            body: JSON.stringify(rows),
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
            }
        })
        if (!response.ok) {
            throw new Error(await response.text())
        }
        let outext = await response.text()
        console.log(outext)
        writeFileSync(`${APP_DATA_DIR}/${DATE_TO_PROCESS.clone().format('MMM-DD-YYYY')}.log`, outext, { encoding: 'utf8', flag: 'w' })

        let logsArray = outext.trim().split("\n").map(s => s.trim())
        logsArray = logsArray.slice(1, -1)
        logsArray = logsArray.filter(s => {
            return s.includes('CREATED')
        })
        logsArray = logsArray.map(s => {
            return s.split(',').map(b => b.trim())
        })
        for (let a = 0; a < logsArray.length; a++) {
            await req.app.locals.db.models.Log.findOrCreate({
                where: {
                    bid: logsArray[a].at(0),
                    date: logsArray[a].at(3),
                    time: logsArray[a].at(4),
                },
                defaults: {
                    bid: logsArray[a].at(0),
                    date: logsArray[a].at(3),
                    time: logsArray[a].at(4),
                },
            });
        }

        // console.log(req.body)
        res.render('sync.html', {
            output: outext
        })
    } catch (err) {
        next(err)
    }
})


// 404 Page
router.use((req, res) => {
    res.status(404)
    res.render('error.html', { error: "Page not found." })
})


module.exports = router