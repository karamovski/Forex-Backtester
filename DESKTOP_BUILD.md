# Forex Signal Backtester - Desktop Build Instructions

This application can be run as a desktop application using Electron, providing direct local file access for tick data processing.

## Prerequisites

- Node.js 18+ installed
- npm or yarn

## Development Mode

To run the desktop app in development mode:

1. First, start the Vite dev server:
   ```bash
   npm run dev
   ```

2. In a separate terminal, build the Electron files:
   ```bash
   npx tsx script/build-electron.ts
   ```

3. Start Electron in development mode:
   ```bash
   npx electron electron-build/main.js
   ```

## Building for Distribution

### Step 1: Build the Frontend

```bash
npm run build
```

This creates the production build in the `dist/` folder.

### Step 2: Build Electron Files

```bash
npx tsx script/build-electron.ts
```

This creates the Electron main process and preload scripts in `electron-build/`.

### Step 3: Package the Application

For Windows:
```bash
npx electron-builder --win
```

For macOS:
```bash
npx electron-builder --mac
```

For Linux:
```bash
npx electron-builder --linux
```

The packaged application will be in the `electron-dist/` folder.

## Desktop vs Web Mode

The application automatically detects if it's running in Electron:

- **Desktop Mode**: Uses native file dialogs to select tick data files directly from your computer. No file upload required - data is processed locally.

- **Web Mode**: Uploads files to the server for processing. Uses chunked upload for large files.

## Features in Desktop Mode

- Native file picker for selecting tick data CSV files
- Multiple file selection support
- Direct local file processing (no upload needed)
- Faster performance for large datasets
- Works completely offline after initial setup

## Supported Platforms

- Windows 10/11 (x64)
- macOS 10.15+ (Intel and Apple Silicon)
- Linux (AppImage and .deb packages)
