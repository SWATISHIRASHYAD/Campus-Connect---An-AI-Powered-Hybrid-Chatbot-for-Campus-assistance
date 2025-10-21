// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your Firebase config
// const firebaseConfig = {
//   apiKey: "AIzaSyBPsdLDsMEDitFO63zbFRU3dI68iINdDDg",
//   authDomain: "campusbot-c6b01.firebaseapp.com",
//   projectId: "campusbot-c6b01",
//   storageBucket: "campusbot-c6b01.appspot.com",
//   messagingSenderId: "778487125107",
//   appId: "1:778487125107:web:45fb8616331f7b76aac606"
// };
const firebaseConfig = {
  apiKey: "AIzaSyDSGatrSUo-spSK_qgTs8rzRUsholDlpUE",
  authDomain: "campusbot-2.firebaseapp.com",
  projectId: "campusbot-2",
  storageBucket: "campusbot-2.firebasestorage.app",
  messagingSenderId: "305531252625",
  appId: "1:305531252625:web:90e17cfa9d38fb563c3430",
  measurementId: "G-JSB86Y0KLM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
