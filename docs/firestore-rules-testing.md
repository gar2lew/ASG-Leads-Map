# Firestore rules tests

The lead authorization suite runs against the Firebase Firestore Emulator, not the production project.

Prerequisites: Node.js 20 or newer and the Firebase CLI available on `PATH` (`firebase --version`). Install the CLI globally if needed with `npm install -g firebase-tools`.

Run the suite from the repository root:

```powershell
npm run test:rules
```

The command uses the isolated `demo-asg-leads-map` project ID, loads `firestore.rules`, and starts the emulator on port `8080`. The emulator binary is downloaded on its first run. No production Firebase credentials or project data are used.
