
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB_Ly061wQRGFW3QxZda3DoPlgIv4RmgJ4",
    authDomain: "lamasia-fe275.firebaseapp.com",
    projectId: "lamasia-fe275",
    storageBucket: "lamasia-fe275.firebasestorage.app",
    messagingSenderId: "530850124722",
    appId: "1:530850124722:web:63206920cdd0a58b0c8aab"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
