(async () => {
  //// Core modules
  const { watchFile, unwatchFile } = require('fs')
  const http = require('http')
  const path = require('path')

  //// External modules
  const { app, BrowserWindow, Menu, ipcMain, shell, Tray } = require('electron') // Modules to control application life and create native browser window
  const bodyParser = require('body-parser')
  // const cookieParser = require('cookie-parser')
  const express = require('express')
  // const jwtLib = require('jsonwebtoken')
  const moment = require('moment')
  const nunjucks = require('nunjucks')

  //// Modules
  const db = require('./db-connect')
  const middlewares = require('./middlewares')
  const routes = require('./routes')
  const session = require('./session')


  global.APP_PORT = 9234
  global.APP_URL = `http://localhost`
  global.APP_SESSION_NAME = `hris_connect_app_sid`
  global.APP_SESSION_SECRET = `Hris_@connect_s3cret!`
  global.APP_SESSION_COOKIE = {
    "httpOnly": false,
    "maxAge": 31536000000,
    "secure": false
  }

  let rootBrowserWindow = null
  global.APP_DIR = path.resolve(__dirname, '..').replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat


  //// Directories
  const PUBLIC_DIR = `${APP_DIR}/src/public`
  const VIEW_DIR = `${APP_DIR}/src/view`
  global.APP_DATA_DIR = app.getPath('userData')
  global.DATABASE_FILE = path.join(APP_DATA_DIR, 'app.db')
  global.BIOMETRIC_FILE = path.join(APP_DATA_DIR, 'biometric-scans.txt')

  //// Setup view
  // Setup nunjucks loader. See https://mozilla.github.io/nunjucks/api.html#loader
  const NUNJUCKS_LOADER_FS = new nunjucks.FileSystemLoader(VIEW_DIR, {
    watch: false,
    noCache: true
  });

  // Setup nunjucks environment. See https://mozilla.github.io/nunjucks/api.html#environment
  const NUNJUCKS_ENV = new nunjucks.Environment(NUNJUCKS_LOADER_FS, {
    "autoescape": true,
    "throwOnUndefined": false,
    "trimBlocks": false,
    "lstripBlocks": false
  });

  // Stringify object.
  NUNJUCKS_ENV.addFilter('stringify', function (value) {
    return JSON.stringify(value);
  });

  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) {
    app.quit();
  }

  const createWindow = async () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 800,
      minWidth: 800,
      height: 800,
      minHeight: 600,
      icon: path.join(APP_DIR, 'src', 'public', 'images', 'icon.png'),
      webPreferences: {
        preload: path.join(APP_DIR, 'src', 'preload.js'),
      },
    });

    // Menu
    const menu = require('./menu')(app, mainWindow)
    Menu.setApplicationMenu(menu)

    // Starting page
    await mainWindow.loadURL(`${APP_URL}:${APP_PORT}`)

    // Restrict navigation
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${APP_URL}:${APP_PORT}`)) {
        event.preventDefault();
        console.error(`Navigation blocked to: ${url}`);
      }
    });

    // Restrict new window creation (Eg. mid mouse click)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.error(`Blocked attempt to open new window for: ${url}`);
        return { action: 'deny' };
      // return { action: 'allow' };
    });

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    return mainWindow
  };

  //// Create app
  const EXPRESS = express()

  //// Server and socket.io
  const HTTP_SERVER = http.createServer(EXPRESS)

  //// Setup view
  NUNJUCKS_ENV.express(EXPRESS)

  // Connect to db
  const dbInstance = await db.connect()
  const dbModels = await db.attachModels(dbInstance)
  EXPRESS.locals.db = {
    instance: dbInstance,
    models: dbModels,
  }

  // Pass {alter: true} if altering
  await EXPRESS.locals.db.models.Log.sync() // This creates the table if it doesn't exist (and does nothing if it already exists)
  await EXPRESS.locals.db.models.BioDevice.sync() // This creates the table if it doesn't exist (and does nothing if it already exists)

  // Session middleware
  EXPRESS.use(session(EXPRESS.locals.db.instance));

  // Static public files
  EXPRESS.use(express.static(PUBLIC_DIR));

  // Parse http body
  EXPRESS.use(bodyParser.json({ limit: '50mb' }));       // to support JSON-encoded bodies
  EXPRESS.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    limit: '50mb',
    extended: true
  }));

  // Assign view variables once - on app start
  EXPRESS.use(middlewares.perAppViewVars)

  //// Routes
  EXPRESS.use(routes);

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    ipcMain.handle('onDataFromFrontend', async (_event, action, params) => {

      const konsol = {
        log: (m) => {
          // Log here
          console.log(m)
          // Log to renderer
          rootBrowserWindow.webContents.send('onDataFromBackend', m)
        }
      }

      if (action === 'watchLogFile') {
        let bioDevice = await dbModels.BioDevice.findOne({
          where: {
            id: params.id
          }
        })
        if (bioDevice) {
          konsol.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: Watching file ${bioDevice.logFile}...`)
          watchFile(`${bioDevice.logFile}`, async (curr, prev) => {
            if (curr.mtimeMs > prev.mtimeMs && curr.size !== prev.size) {

              const DATE_TO_PROCESS = moment()
              konsol.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: File change detected (${bioDevice.name}), uploading file for ${DATE_TO_PROCESS.format('dddd MMM DD, YYYY')}...`)

              let outext = await require('./sync').syncToServer(EXPRESS.locals.db, bioDevice.logFile, DATE_TO_PROCESS, bioDevice.username, bioDevice.password, bioDevice.endPoint)

            }
          });
          bioDevice.watching = true
          await bioDevice.save()
          await new Promise(resolve => setTimeout(resolve, 600)) // Rate limit 
          return true
        }

      } else if (action === 'unwatchLogFile') {
        let bioDevice = await dbModels.BioDevice.findOne({
          where: {
            id: params.id
          }
        })
        if (bioDevice) {
          konsol.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: Unwatching file ${bioDevice.logFile}...`)
          unwatchFile(`${bioDevice.logFile}`);
          bioDevice.watching = false
          await bioDevice.save()
          await new Promise(resolve => setTimeout(resolve, 600)) // Rate limit 
          return true
        }
      }

      return false

    })

    // Finally the server
    HTTP_SERVER.listen(APP_PORT, () => {
      console.log(`${moment().format('YYYY-MMM-DD hh:mm:ss A')}: App server running at "${APP_URL}:${APP_PORT}"`);






      // Set their flag to true
      dbModels.BioDevice.update({
        watching: true
      }, {
        where: {}
      }).then(() => {

        // 
        createWindow().then((_rootBrowserWindow) => {
          rootBrowserWindow = _rootBrowserWindow

          const konsol = {
            log: (m) => {
              // Log here
              console.log(m)
              // Log to renderer
              rootBrowserWindow.webContents.send('onDataFromBackend', m)
            }
          }

          // 
          dbModels.BioDevice.findAll({
            where: {}
          }).then((bioDevices) => {
            // Watch all devices logs
            for (let x = 0; x < bioDevices.length; x++) {
              let bioDevice = bioDevices[x]
              konsol.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: Watching file ${bioDevice.logFile}...`)
              watchFile(`${bioDevice.logFile}`, async (curr, prev) => {
                if (curr.mtimeMs > prev.mtimeMs && curr.size !== prev.size) {
                  const DATE_TO_PROCESS = moment()
                  konsol.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: File change detected (${bioDevice.name}), uploading file for ${DATE_TO_PROCESS.format('dddd MMM DD, YYYY')}...`)
                  let outext = await require('./sync').syncToServer(EXPRESS.locals.db, bioDevice.logFile, DATE_TO_PROCESS, bioDevice.username, bioDevice.password, bioDevice.endPoint)
                }
              });
            }

          }).catch(err => console.error(err))
          // 

        })

      }).catch(err => console.error(err))

    });
    HTTP_SERVER.keepAliveTimeout = 60000 * 2;



    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })

  app.on('window-all-closed', (event) => {
    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  let quittedFlag = false

  app.on('before-quit', async (event) => {
    if (!quittedFlag) {
      event.preventDefault()
      console.log(`${moment().format('YYYY-MMM-DD hh:mm:ss A')}: App server stopping...`);
      HTTP_SERVER.close(() => {
        console.log(`${moment().format('YYYY-MMM-DD hh:mm:ss A')}: App server stopped.`);
      });

      let bioDevices = await dbModels.BioDevice.findAll({
        where: {}
      })
      bioDevices.forEach((bioDevice) => {
        console.log(`${moment().format('MMM-DD-YYYY hh:mmA')}: Unwatching file ${bioDevice.logFile}...`)
        unwatchFile(`${bioDevice.logFile}`);
      })
      // Reset all
      await dbModels.BioDevice.update({
        watching: false
      }, {
        where: {}
      })
      quittedFlag = true
      app.quit()
    }
  });

  process.on('uncaughtException', function (e) {
    console.error(e);
    app.quit()
  });

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.
})()