import { app, BrowserWindow } from 'electron';
import path from 'path';
import url, { fileURLToPath, pathToFileURL } from 'url';
import { spawn } from 'child_process'; // Import spawn

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess; // To hold the server process

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Temporarily disable web security for local resource loading
    },
  });

  // Start the backend server if not in development (Vite dev server)
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment) {
    const serverPath = path.join(__dirname, '..', 'dist', 'index.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit', // Pipe server output to Electron's console
      env: { ...process.env, NODE_ENV: 'production' } // Ensure server runs in production mode
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`Server process exited with code ${code} and signal ${signal}`);
    });
  }

  // Load the built HTML file
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173'); // Assuming Vite dev server runs on 5173
  } else {
    const indexPath = path.join(process.resourcesPath, 'public', 'index.html');
    const fileUrl = url.format(pathToFileURL(indexPath).href);
    mainWindow.loadURL(fileUrl);
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Kill the server process when the main window is closed
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
