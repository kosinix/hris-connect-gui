//// Core modules


//// External modules
const { Menu, shell } = require('electron') // Modules to control application life and create native browser window

//// Modules


module.exports = (app, mainWindow) => {
    return Menu.buildFromTemplate([
        {
            label: '&App',
            submenu: [
                {
                    label: 'Home',
                    // accelerator: 'Home', // Optional: Add a keyboard shortcut
                    click: async () => {
                        mainWindow.loadURL(`${APP_URL}:${APP_PORT}/`)
                    }
                },
                {
                    label: 'Logout',
                    click: async () => {
                        mainWindow.loadURL(`${APP_URL}:${APP_PORT}/logout`)
                    }
                },
                {
                    label: 'Quit',
                    click: async () => {
                        app.quit()
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
                },
                {
                    label: 'Open Data Directory',
                    click: async () => {
                        shell.openPath(APP_DATA_DIR)
                    }
                },
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'About',
                    click: async () => {
                        // await shell.openExternal('https://ict.gsu.edu.ph')
                        mainWindow.loadURL(`${APP_URL}:${APP_PORT}/about`)
                    }
                }
            ]
        }
    ])
}