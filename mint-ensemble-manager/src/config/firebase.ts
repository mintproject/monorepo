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
export const fieldPath = admin.firestore.FieldPath;
export const increment = admin.firestore.FieldValue.increment(1);