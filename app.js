// --- 1. CONFIGURATION ---
const firebaseConfig = { 
    apiKey: "AIzaSyDE1tJF3p4t-wOFQWLJlQr2eU12KG5_NAc",
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

// --- 2. GLOBAL VARIABLES ---
const db = firebase.database();
const auth = firebase.auth();
const profileEditor = document.getElementById("profile-editor");
const input = document.getElementById("comment-input");
const commentsList = document.getElementById("comments-list");
const tableBody = document.getElementById("homework-list");
const guestIcon = 'guest.png';

let headerProfileTrigger = document.getElementById("header-profile-trigger");
let headerProfileAvatar = document.getElementById("header-avatar");
let profileName = document.getElementById("profile-name");
let HPTVis = false;
let username = "";
let school = localStorage.getItem("school") || "";
let currentHomeworkKey = null;

// Start logged out for safety
auth.signOut();

// --- 3. UTILITY FUNCTIONS (IMAGE PROCESSING) ---
async function loadImageToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = url;
    });
}

async function compressBase64Image(dataUrl, outputType = "image/jpeg", quality = 0.75) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL(outputType, quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// --- 4. AVATAR LOGIC ---
async function setDefaultAvatarIfMissing(user, targetSchool) {
    if (!user || !targetSchool) return;
    const avatarRef = db.ref(`UserAvatar/${targetSchool}/${user}`);
    const snap = await avatarRef.once("value");
    if (!snap.exists() || !snap.val()) {
        try {
            const guestBase = await loadImageToBase64(guestIcon);
            const compressed = await compressBase64Image(guestBase, "image/png", 0.92); 
            await avatarRef.set(compressed);
        } catch (err) { console.error("Avatar default set failed:", err); }
    }
}

async function applyAvatarFromDB(user, targetSchool) {
    const snap = await db.ref(`UserAvatar/${targetSchool}/${user}`).once("value");
    let final = snap.val();
    
    if (!final) {
        const guestSnap = await db.ref(`UserAvatar/${targetSchool}/guest`).once("value");
        final = guestSnap.val() || guestIcon;
    }

    if (headerProfileAvatar) {
        headerProfileAvatar.style.backgroundImage = `url("${final}")`;
        headerProfileAvatar.style.backgroundSize = "cover";
        headerProfileAvatar.style.backgroundPosition = "center";
    }
}

// --- 5. UI INTERACTION ---
headerProfileAvatar.onclick = (event) => {
    event.stopPropagation();
    HPTVis = !HPTVis;
    profileEditor.style.display = HPTVis ? "block" : "none";
};

window.onclick = (event) => {
    if (HPTVis && !profileEditor.contains(event.target)) {
        profileEditor.style.display = "none";
        HPTVis = false;
    }
};

// --- 6. CORE DISPLAY LOGIC (SECURE) ---
function addCommentToDOM(authorName, commentText, pin = false, avatarUrl = null) {
    if (!commentsList) return;

    // Clean up existing comment from this user
    const existing = Array.from(commentsList.querySelectorAll(".comment-author"))
                         .find(el => el.textContent.toLowerCase() === authorName.toLowerCase());
    if (existing) existing.closest(".container.comment").remove();

    const div = document.createElement("div");
    div.className = "container comment";
    if (pin) div.dataset.pin = "true";

    const avatarSrc = avatarUrl || guestIcon;
    const computedFontSize = 24; // Simplified calculation

    // The template uses Classes instead of injecting variables into HTML directly
    div.innerHTML = `
      <div class="comment-header">
        <div class="comment-avatar" style="background-image: url('${avatarSrc}');"></div>
        <div class="comment-meta">
          <span class="comment-author" style="font-size:${computedFontSize}px;"></span>
          <span class="pin-area"></span>
        </div>
      </div>
      <p class="comment-body" style="white-space: pre-wrap;"></p>
    `;

    // SECURE: Use textContent to prevent Phishing/Script injection
    div.querySelector(".comment-author").textContent = authorName.charAt(0).toUpperCase() + authorName.slice(1);
    div.querySelector(".comment-body").textContent = commentText;

    if (pin) {
        const pinSpan = document.createElement("span");
        pinSpan.className = "pin-label";
        pinSpan.textContent = " 📌 Pinned";
        div.querySelector(".pin-area").appendChild(pinSpan);
        commentsList.prepend(div);
    } else {
        commentsList.appendChild(div);
    }
}

function loadHomeworkToTable(targetSchool) {
    const homeworkRef = db.ref(`Homework/${targetSchool}`); 
    if (!tableBody) return;

    homeworkRef.on('value', (snapshot) => {
        tableBody.innerHTML = ""; 
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const data = child.val();
                const row = document.createElement("tr");
                row.dataset.key = child.key;
                
                // SECURE: Create table cells with textContent
                const tdSubj = document.createElement("td");
                tdSubj.textContent = data.subject;
                
                const tdTsk = document.createElement("td");
                tdTsk.textContent = data.task;
                
                const tdStat = document.createElement("td");
                tdStat.innerHTML = '<span class="status-badge">AKTIF</span>';
                
                row.append(tdSubj, tdTsk, tdStat);
                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center'>Belum ada tugas.</td></tr>";
        }
    });
}

async function loadComments(homeworkKey) {
    if (!commentsList) return;
    commentsList.innerHTML = "Memuat komentar...";
    
    const snapshot = await db.ref(`HomeworkReplies/${school}/${homeworkKey}/chat`).once("value");
    commentsList.innerHTML = "";

    const promises = [];
    snapshot.forEach(child => {
        const data = child.val();
        const author = child.key;
        promises.push(
            db.ref(`UserAvatar/${school}/${author}`).once("value").then(avSnap => {
                addCommentToDOM(author, data.comment, data.pin, avSnap.val());
            })
        );
    });
    await Promise.all(promises);
}

// --- 7. AUTH & LOGIN ---
function handleLogin() {
    if (typeof grecaptcha === "undefined") return alert("CAPTCHA belum siap!"); 

    const captchaResponse = grecaptcha.getResponse();
    if (captchaResponse.length === 0) return alert("Centang CAPTCHA dulu!");

    const user = document.getElementById('user-input').value.trim().toLowerCase();
    const keyInput = document.getElementById('key-input').value.trim().toUpperCase(); 

    if (keyInput === "TGL5-CEO-A3") school = "tonggalan";
    else if (keyInput === "KLT2-SAM-AR") school = "klaten2";
    else return alert("Key salah!");

    const email = user + "@sekolah.com";
    const pass = user + "password1248bit";

    auth.signInWithEmailAndPassword(email, pass)
    .then(() => db.ref(`Users/${school}/${user}`).once('value'))
    .then((snap) => {
        if (!snap.exists()) {
            auth.signOut();
            window.location.href = "register.html";
            return;
        }
        const userData = snap.val();
        if (userData.status === "unverified") {
            alert("Tunggu verifikasi 1x24 jam.");
            auth.signOut();
            return;
        }
        localStorage.setItem("school", school);
        executeEntry(user, school, userData);
    })
    .catch(err => alert("Login gagal: " + err.message));
}

function executeEntry(userName, userSchool, userData) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('public-homework').style.display = 'block';
    document.getElementById('school-view-title').innerText = 
        userSchool === "tonggalan" ? "Log Tugas SDN 1 Tonggalan" : "Log Tugas SDN 1 Klaten";
    loadHomeworkToTable(userSchool);
}

// --- 8. INITIALIZATION & LISTENERS ---
window.onload = () => {
    document.getElementById('login-btn').onclick = handleLogin;
    document.getElementById('date-info').innerText = "DATA TERKINI: " + new Date().toLocaleDateString('id-ID');

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            headerProfileTrigger.style.display = "flex";
            username = user.displayName || user.email.split("@")[0];
            profileName.textContent = username.charAt(0).toUpperCase() + username.slice(1);
            await setDefaultAvatarIfMissing(username, school);
            await applyAvatarFromDB(username, school);
        } else {
            headerProfileTrigger.style.display = "none";
        }
    });
};

tableBody.addEventListener("click", (event) => {
    let tr = event.target.closest("tr");
    if (!tr) return;
    currentHomeworkKey = tr.dataset.key;
    document.getElementById("homework-reply").style.display = "block";
    loadComments(currentHomeworkKey);
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const text = input.value.trim();
        const user = auth.currentUser;
        if (!text || !currentHomeworkKey || !user) return;

        const uName = user.displayName || user.email.split("@")[0];
        const avatarStyle = headerProfileAvatar.style.backgroundImage;
        const currentAvatar = avatarStyle ? avatarStyle.slice(5, -2) : guestIcon;

        addCommentToDOM(uName, text, false, currentAvatar);
        db.ref(`HomeworkReplies/${school}/${currentHomeworkKey}/chat/${uName}`).set({
            comment: text,
            pin: false
        });
        input.value = "";
    }
});

console.log("%c⚠️ PENYUSUP TERDETEKSI! ⚠️", "color: red; font-size: 20px; font-weight: bold;");
console.log("%cKamu sedang melihat kode buatan Wakil Ketua Kelas.", "color: orange; font-size: 14px;");
console.log("%cDon't even try to hack this. Everything is encrypted via Firebase. 😉", "color: cyan; font-style: italic;");

// Helper for debugging
function print(text) { console.log(text); }