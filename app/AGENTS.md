# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

This app is PINNED to Expo SDK 54. Do not upgrade the `expo` package (or any
expo-* / react-native versions) without the user's say-so.

Camera is react-native-vision-camera (native module) — **Expo Go no longer runs
this app**; test via the TestFlight build. runtimeVersion policy is appVersion:
bump `version` in app.json AND trigger a native build ([build-ios] commit tag)
whenever native modules change. JS-only changes ship OTA via the sdk-54 branch
(.github/workflows/eas-update.yml) and reach the installed build automatically.
