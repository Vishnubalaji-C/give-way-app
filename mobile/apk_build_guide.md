# 📱 GiveWay Mobile Application — APK Deployment Guide

This guide provides the official steps to build and deploy the **GiveWay Terminal** (Flutter) to your Android device for the project defense.

## 📋 Prerequisites
1. **Flutter SDK**: Ensure Flutter is installed and added to your system PATH.
2. **Android Studio**: Installed with **Android SDK Command-line Tools**.
3. **Java (JDK)**: Version 11 or 17 is recommended.

---

## 🚀 Build Steps

### 1. Open Terminal
Navigate to the mobile directory:
```powershell
cd c:\Users\MSI\Desktop\MakeWay\mobile
```

### 2. Fetch Dependencies
Run this command to download necessary Flutter packages:
```powershell
flutter pub get
```

### 3. Clean Previous Builds (Optional)
If you have built the app before, it's good to start fresh:
```powershell
flutter clean
```

### 4. Build the Release APK
Run the following command to generate the optimized production file:
```powershell
flutter build apk --release
```

---

## 📂 Locating the File
Once the build is complete, your APK will be located here:
`[Project Path]\mobile\build\app\outputs\flutter-apk\app-release.apk`

---

## 💡 Troubleshooting
- **Gradle Errors**: If you see "Gradle task assembleRelease failed," try running `flutter doctor` to ensure your Android toolchain is correctly configured.
- **Icon Issues**: If the launcher icon doesn't update, run `flutter pub run flutter_launcher_icons` (after adding the dependency in pubspec if you choose to use it).
