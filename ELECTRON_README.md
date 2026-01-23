# Electron Desktop App

This Next.js application has been converted to an Electron desktop app.

## Development

To run the app in development mode:

```bash
pnpm electron:dev
```

This will start the Next.js dev server and launch Electron with hot reload enabled.

## Building

To build the desktop application:

### Windows
```bash
pnpm electron:build:win
```

### macOS
```bash
pnpm electron:build:mac
```

### Linux
```bash
pnpm electron:build:linux
```

### All platforms
```bash
pnpm electron:build
```

The built application will be in the `dist/` folder.

## Notes

- The app uses Next.js static export mode for Electron compatibility
- Icons should be placed in the `public/` folder (icon.png, icon.ico, icon.icns)
- The Electron app loads from `http://localhost:3000` in development
- In production, it loads from the exported static files in the `out/` folder
