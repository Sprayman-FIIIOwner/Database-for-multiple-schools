const firebaseConfig = { 
    apiKey: "AIzaSyDirN1tq0stXrHSLCx7Xzom0azDW9R0yog",
    authDomain: "database-pr-sekolah.firebaseapp.com",
    databaseURL: "https://database-pr-sekolah-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "database-pr-sekolah",
    storageBucket: "database-pr-sekolah.firebasestorage.app",
    messagingSenderId: "699468097429",
    appId: "1:699468097429:web:197f697f86e6176e49b89c"
};

if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig);
}

window.db = firebase.database();
window.auth = firebase.auth();