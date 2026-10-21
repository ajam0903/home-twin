// The Firebase project that holds the shared house data (notes, saved
// measurements, the furniture layout). These values identify the project and
// are meant to be public; firestore.rules decides who may write.
// null: the app keeps everything in this browser, as before.
export const firebaseConfig = {
  apiKey: 'AIzaSyDUGmbmwZVPaPHIw_K48sLDfnqpgwYppsA',
  authDomain: 'home-twin-orchard.firebaseapp.com',
  projectId: 'home-twin-orchard',
  storageBucket: 'home-twin-orchard.firebasestorage.app',
  messagingSenderId: '477524037041',
  appId: '1:477524037041:web:dd3c7311c2f1a573bec190',
}

// Google accounts that may edit (Firebase Auth user ids). Keep in step with
// firestore.rules, which is what actually enforces it.
export const ADMIN_UIDS = ['7Pe9gN2NeAXCWQ5XF7kAA9qTdYb2'] // ajamali0903 (Google)
