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


router.get('/about', async (req, res, next) => {
    try {
        res.render('about.html')
    } catch (err) {
        next(err)
    }
})
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
        let bioDevices = await req.app.locals.db.models.BioDevice.findAll({})
        let data = {
            bioDevices
        }
        // return res.redirect('/bio-devices')
        res.render('home.html', data)
    } catch (err) {
        next(err)
    }
})
router.get('/bio-devices', middlewares.requireAuth, async (req, res, next) => {
    try {
        let bioDevices = await req.app.locals.db.models.BioDevice.findAll({})
        let data = {
            bioDevices
        }
        res.render('bio-devices/create.html', data)
    } catch (err) {
        next(err)
    }
})
router.post('/bio-devices', middlewares.requireAuth, async (req, res, next) => {
    try {
        let data = req.body

        let bioDevice = await req.app.locals.db.models.BioDevice.create({
            name: data.name,
            ip: data.ip,
            port: data.port,
            timeout: data.timeout,
            logFile: data.logFile.replace(/"/g, '').replace(/\\/g, '/'),
            endPoint: data.endPoint,
            username: data.username,
            password: data.password
        });

        // return res.send(bioDevice)
        // flash.ok(req, 'bioDevice', 'Device connector created.')
        res.redirect(`/`)
    } catch (err) {
        next(err)
    }
})
router.get('/bio-device/:bioDeviceId/update', middlewares.requireAuth, middlewares.getBioDevice(), async (req, res, next) => {
    try {
        let bioDevice = res.bioDevice

        let data = {
            flash: flash.get(req, 'bioDevice'),
            bioDevice: bioDevice,
        }
        // return res.send(data)
        res.render('bio-devices/update.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/bio-device/:bioDeviceId/update', middlewares.requireAuth, middlewares.getBioDevice(), async (req, res, next) => {
    try {
        let bioDevice = res.bioDevice
        let data = req.body
        data.logFile = data.logFile.replace(/"/g, '').replace(/\\/g, '/'),
        // console.log(data)
        // return res.send(data)

        await req.app.locals.db.models.BioDevice.update({
            name: data.name,
            ip: data.ip,
            port: data.port,
            timeout: data.timeout,
            logFile: data.logFile,
            endPoint: data.endPoint,
            username: data.username,
            password: (data.password) ? data.password : bioDevice.password
        }, {
            where: {
                id: bioDevice.id
            },
        })

        if (req.xhr) {
            return res.send(data)
        }
        res.redirect(`/`)
    } catch (err) {
        next(err);
    }
});

// router.get('/bio-device/:bioDeviceId/status', middlewares.requireAuth, middlewares.getBioDevice(), async (req, res, next) => {
//     try {
//         let bioDevice = res.bioDevice

//         const ZKHLIB = require("zkh-lib");
//         let zkDevice = new ZKHLIB(bioDevice.ip, bioDevice.port, bioDevice.timeout, 4000);

//         // Create socket to machine
//         await zkDevice.createSocket();

//         // Get all logs in the machine
//         const logs = await zkDevice.getAttendances();
//         logs.data.forEach((log) => {
//             console.log(log)
//         })

//         // Disconnect from device
//         await zkDevice.disconnect(); // when you are using real-time logs, you need to disconnect manually

//         let data = {
//             flash: flash.get(req, 'bioDevice'),
//             bioDevice: bioDevice,
//         }
//         // return res.send(data)
//         res.render('bio-devices/update.html', data);
//     } catch (err) {
//         next(err);
//     }
// });

router.get('/bio-device/:bioDeviceId/sync', middlewares.requireAuth, middlewares.getBioDevice(), async (req, res, next) => {
    try {
        let bioDevice = res.bioDevice

        let data = {
            flash: flash.get(req, 'bioDevice'),
            bioDevice: bioDevice,
        }
        // return res.send(data)
        res.render('bio-devices/sync.html', data);
    } catch (err) {
        next(err);
    }
});
router.post('/bio-device/:bioDeviceId/sync', middlewares.requireAuth, middlewares.getBioDevice(), async (req, res, next) => {
    try {
        let bioDevice = res.bioDevice
        let data = req.body
        data.date = (data?.date) ? moment(data?.date) : moment()

        // console.log(data, bioDevice)
        let syncher = require('./sync')
        let outext = await syncher.syncToServer(req.app.locals.db, bioDevice.logFile, data.date, bioDevice.username, bioDevice.password, bioDevice.endPoint)
       
        res.render('bio-devices/sync-result.html', {
            output: outext
        });
    } catch (err) {
        next(err);
    }
});

// 404 Page
router.use((req, res) => {
    res.status(404)
    res.render('error.html', { error: "Page not found." })
})


module.exports = router