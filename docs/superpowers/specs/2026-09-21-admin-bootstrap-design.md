# One-Time Administrator Bootstrap

## Purpose

Let the first ASG Leads Map administrator establish their own six-digit PIN without placing that PIN in Vercel. The flow must create exactly one active `super_admin` Firebase Authentication and Firestore account, and must be impossible to replay after successful completion.

## Preconditions

Vercel must have working Firebase Admin service-account variables for the `leadsmapasg` project:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Vercel also stores a sensitive, randomly generated `ADMIN_SETUP_CODE`. It authorises only first-admin setup; it is not an ongoing login credential.

## First-Admin Setup

The unauthenticated `/setup-admin` page collects the setup code, administrator email, Firebase password, and matching six-digit PIN entries. It posts them only to a new server-side bootstrap endpoint.

The endpoint validates input, compares the setup code using a timing-safe comparison, and runs a Firestore transaction on a singleton configuration document. The transaction refuses the request if bootstrap was previously completed or a `super_admin` profile already exists. It creates the Firebase Auth user and writes one active `users/{uid}` profile with role `super_admin`, a salted PIN hash, and a completion marker. The endpoint returns a Firebase custom token so the browser can establish its authenticated session immediately.

If Firebase Auth user creation succeeds but the Firestore transaction cannot complete, the endpoint removes the newly-created Auth user before returning an error. A failed request never sets the completion marker.

## Administrator Sign-In

The Administrator tab continues to accept one six-digit PIN. The admin login endpoint loads the sole active `super_admin` Firestore document, validates the stored salted hash with timing-safe comparison, and returns a Firebase custom token on success. It returns a generic credential error for an unknown or incorrect PIN.

The global `ADMIN_LOGIN_PIN` variable is removed from the application path. After bootstrap, retaining `ADMIN_SETUP_CODE` in Vercel is harmless because the completion marker prevents reuse; it can be manually rotated or removed.

## Failure Handling

The setup endpoint uses non-sensitive messages for invalid setup codes and PINs. Configuration or Firebase failures are logged server-side with an operation label and return a generic retry message. The login endpoint distinguishes only user-actionable account states from generic errors; it never exposes credential content, Firebase tokens, or service-account information.

## Verification

Automated coverage proves input validation, successful bootstrap, a rejected second bootstrap, incorrect setup-code rejection, incorrect admin-PIN rejection, and successful custom-token response. Existing administrator login tests are updated from the obsolete email/password flow to the PIN flow.

Deployment verification first confirms the Firebase Admin service account can initialize against `leadsmapasg`, then adds `ADMIN_SETUP_CODE` to Vercel Production, deploys, completes setup once through the browser, signs out and signs back in with the chosen PIN, and confirms a second setup attempt is rejected.
