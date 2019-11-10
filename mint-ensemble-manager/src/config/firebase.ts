import * as admin from "firebase-admin";

export const initializeFirebase = () => {
    return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: "https://mint-full.firebaseio.com"
    });
}

let app = initializeFirebase();
export const db = admin.firestore(app);
export const fieldValue = admin.firestore.FieldValue;