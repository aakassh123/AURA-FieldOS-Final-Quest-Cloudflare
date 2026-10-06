# AURA FieldOS Mobile — Stage 12 production hardening

## Build profiles
- development: internal development client
- preview: internal tester build
- production: Android App Bundle / iOS App Store build

## Before EAS build
1. Replace the placeholder EAS project ID in `app.json`.
2. Set production Expo environment variables in EAS.
3. Confirm Android package and iOS bundle identifier are owned by the AURA app.
4. Test foreground and background location on physical devices.
5. Test push notifications on physical devices.

## Commands
```bash
npm install
npx expo-doctor
eas build --platform android --profile production
eas build --platform ios --profile production
```
