# Nimbus Nook Mobile

This folder contains lightweight native wrappers for Nimbus Nook.

## Android

The Android version is a native WebView shell that bundles the current static app in `app/src/main/assets`.

Build from the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File mobile\android\build.ps1
```

The signed debug APK is written to:

```text
dist\NimbusNook-debug.apk
```

## iPhone

An iOS IPA cannot be built or signed from this Windows workspace. Apple requires macOS with Xcode plus an Apple Developer signing identity to produce a working `.ipa` for iPhone installation.

The Swift files in `mobile/ios/NimbusNook` are a small WKWebView wrapper starter that can be dropped into an Xcode iOS app target and pointed at:

```text
https://cosmicbubblegumgirl.github.io/nimbus-nook/
```
