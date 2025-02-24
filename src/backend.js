(async () => {
  //// Core modules
  const http = require('http')
  const path = require('path')

  //// External modules
  const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron') // Modules to control application life and create native browser window
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


  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) {
    app.quit();
  }

  const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    //////////////////
    const menu = Menu.buildFromTemplate([
      {
        label: '&App',
        submenu: [
          {
            label: 'Home',
            accelerator: 'Home', // Optional: Add a keyboard shortcut
            click: async () => {
              mainWindow.loadURL(`${APP_URL}:${APP_PORT}/`)
            }
          },
          {
            label: 'Show Data Directory',
            click: async () => {
              shell.openPath(APP_DATA_DIR)
            }
          },
          {
            label: 'Logout',
            click: async () => {
              mainWindow.loadURL(`${APP_URL}:${APP_PORT}/logout`)
            }
          },
          // { role: 'quit' },
        ]
      },
      {
        label: '&View',
        submenu: [
          {
            label: 'Toggle Full Screen',
            accelerator: 'F11', // Optional: Add a keyboard shortcut
            click: () => {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        ]
      },
      {
        role: 'help',
        submenu: [
          {
            label: 'About',
            click: async () => {
              await shell.openExternal('https://ict.gsu.edu.ph')
            }
          }
        ]
      }
    ])
    Menu.setApplicationMenu(menu)
    //////////////////////////////////////

    mainWindow.loadURL(`${APP_URL}:${APP_PORT}`)

    // Restrict navigation
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(`${APP_URL}:${APP_PORT}`)) {
        event.preventDefault();
        console.error(`Navigation blocked to: ${url}`);
      }
    });

    // Restrict new window creation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (!url.startsWith(`${APP_URL}:${APP_PORT}`)) {
        console.error(`Blocked attempt to open new window for: ${url}`);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

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

  await EXPRESS.locals.db.models.Log.sync() // This creates the table if it doesn't exist (and does nothing if it already exists)

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
   
    })

    // Finally the server
    HTTP_SERVER.listen(APP_PORT, function () {
      console.log(`${moment().format('YYYY-MMM-DD hh:mm:ss A')}: App running at "${APP_URL}:${APP_PORT}"`);
      rootBrowserWindow = createWindow();

    });
    HTTP_SERVER.keepAliveTimeout = 60000 * 2;



    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and import them here.
})()