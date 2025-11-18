const firebaseConfig = {
    apiKey: "AIzaSyBQf-ILFW6jDV-c_O2LG6elA5oAB84p2XQ",
    authDomain: "top-news-91db8.firebaseapp.com",
    databaseURL: "https://top-news-91db8-default-rtdb.firebaseio.com",
    projectId: "top-news-91db8",
    storageBucket: "top-news-91db8.firebasestorage.app",
    messagingSenderId: "348369077928",
    appId: "1:348369077928:web:7629c503c30cbf7450649d",
    measurementId: "G-7GMX8N2NSC"
  };

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let userId = null;

function loadProfileData() {
    if (!window.Telegram?.WebApp) return alert("টেলিগ্রাম থেকে খুলুন!");

    Telegram.WebApp.ready();
    const user = Telegram.WebApp.initDataUnsafe.user;

    userId = user.id.toString();

    const name = user.first_name + (user.last_name ? " " + user.last_name : "");
    const username = user.username ? "@" + user.username : "@user" + user.id;
    const photo = user.photo_url || "";

    document.getElementById("profile-name").innerText = name;
    document.getElementById("profile-username").innerText = username;
    document.getElementById("user-id").innerText = user.id;

    if (photo) {
        document.getElementById("profile-photo").src = photo;
    }

    // Firebase থেকে ব্যালেন্স + রেফারেল
    db.ref("users/" + userId).on("value", snap => {
        const data = snap.val() || {};
        document.getElementById("current-balance").innerText = "৳" + (data.balance || 0);
        document.getElementById("total-referrals").innerText = (data.referrals || 0) + " Users";
        document.getElementById("user-country").innerText = data.country === "Bangladesh" ? "Bangladesh" : "International";
    });
}

function openSupport() {
    Telegram.WebApp.openTelegramLink("https://t.me/Headline_newsbot"); // তোর সাপোর্ট বট/চ্যানেল
}

function logout() {
    document.getElementById("logout-popup").style.display = "flex";
}

function confirmLogout() {
    localStorage.clear();
    Telegram.WebApp.close();
}

// পেজ লোড
document.addEventListener('DOMContentLoaded', () => {
    loadProfileData();
});