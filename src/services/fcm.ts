import fcmAdmin from "firebase-admin";

if (!fcmAdmin.apps.length) {
  fcmAdmin.initializeApp({
    credential: fcmAdmin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export { fcmAdmin };
