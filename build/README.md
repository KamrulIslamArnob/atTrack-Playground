# Build Assets

This folder contains all assets required for building and packaging the Electron desktop app.

## Structure

```
build/
├── icons/                  # App icons for all platforms
│   ├── mac.icns           # macOS icon (1024x1024 source)
│   ├── windows.ico        # Windows icon (256x256)
│   └── linux.png          # Linux icon (512x512)
├── entitlements/           # macOS code signing entitlements
│   ├── entitlements.plist         # Main app entitlements
│   └── entitlements.inherit.plist # Inherited entitlements
└── installer/              # Installer customization assets
    ├── dmg-background.png # DMG background image (optional)
    └── dmg-icon.icns      # DMG volume icon (optional)
```

## Platform Requirements

| Platform | Icon | Signing | Notarization |
|----------|------|---------|--------------|
| Windows  | `.ico` | Code-signing certificate (OV/EV) | Not required |
| macOS    | `.icns` | Developer ID certificate | Required (via Apple) |
| Linux    | `.png` | Not required | Not required |

## Notes

- All icons should be high-resolution source images downsized for each platform
- The `entitlements/` files are required for macOS hardened runtime and notarization
- The `installer/` assets are optional polish for the DMG installer
