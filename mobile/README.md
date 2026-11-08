# Polypharm ADE mobile app

The iOS and Android app uses Expo and React Native. It is a native interface for the public safety updates and education on the Polypharm ADE website, with a private on-device medicine-name list and a link to the existing sign-in based FDA label lookup.

## Run locally

```powershell
npm install
npm start
```

Run `npx expo start` and use a compatible Expo Go client or an EAS development build on a device. Because Expo Go support varies by platform and SDK, EAS development builds are the reliable route for testing this SDK on both iOS and Android.

## Build for stores

The project uses Expo Application Services (EAS) cloud builds so both platform builds can be produced without Xcode on this Windows machine. Store builds and submissions still require the owner’s Apple and Google developer accounts, signing credentials, listing assets, privacy declarations, and review approval.

The bundle identifier and Android package name are currently `com.michaelmuriuki.polypharmade`; confirm ownership and availability before the first store submission because app identifiers are difficult to change after release.

## Data handling

- The public report screen retrieves the published safety summary through the existing website API.
- The medicine-name list is stored locally using Expo SecureStore and is not sent to the service.
- Sharing the list is an explicit action through the operating system share sheet.
- The FDA label lookup remains on the existing website and requires its account sign-in.
