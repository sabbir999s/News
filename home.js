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

let currentUser = null;
let deviceId = "";

// ডিভাইস আইডি তৈরি (এক ফোন = এক আইডি)
function getDeviceId() {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("device_fingerprint", 2, 2);
    let data = canvas.toDataURL();
    return btoa(navigator.userAgent + screen.width + data).substring(0, 50);
}
deviceId = getDeviceId();

// পপআপ দেখানো
function showPopup(msg) {
    document.getElementById("popup-message").innerText = msg;
    document.getElementById("popup").style.display = "flex";
    setTimeout(() => document.getElementById("popup").style.display = "none", 3000);
}

// ইউজার লোড + রেফারেল চেক
function initUser() {
    if (!window.Telegram?.WebApp) return alert("টেলিগ্রাম থেকে খুলুন!");
    Telegram.WebApp.ready();
    const tg = Telegram.WebApp.initDataUnsafe;
    const user = tg.user || { id: Date.now(), first_name: "Guest" };

    currentUser = {
        id: user.id.toString(),
        name: user.first_name + (user.last_name ? " " + user.last_name : ""),
        username: user.username || "user" + user.id,
        photo: user.photo_url || "",
        country: tg.language_code === "bn" ? "Bangladesh" : "Unknown",
        balance: 0,
        referrals: 0,
        deviceId: deviceId,
        joinTime: Date.now()
    };

    if (currentUser.photo) document.getElementById("user-photo").src = currentUser.photo;

    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("start");

    db.ref("users/" + currentUser.id).once("value").then(snap => {
        const exists = snap.val();
        if (exists) {
            currentUser = { ...currentUser, ...exists };
            updateUI();
            loadNews();
        } else if (refId && refId !== currentUser.id) {
            giveReferralBonus(refId);
        } else {
            db.ref("users/" + currentUser.id).set(currentUser);
            showPopup("স্বাগতম! রেফারেল ছাড়া জয়েন করেছেন।");
            updateUI();
            loadNews();
        }
    });
}

// রেফারেল বোনাস (দুজনেই ৫ টাকা)
function giveReferralBonus(refId) {
    const bonus = 5;
    db.ref("users/" + refId).once("value").then(snap => {
        const referrer = snap.val();
        if (referrer && referrer.deviceId !== deviceId) {
            db.ref("users/" + refId + "/balance").transaction(v => (v || 0) + bonus);
            db.ref("users/" + refId + "/referrals").transaction(v => (v || 0) + 1);
            currentUser.balance = bonus;
            db.ref("users/" + currentUser.id).set(currentUser);
            showPopup("রেফারেল বোনাস! আপনি পেয়েছেন ৫ টাকা!");
        } else {
            db.ref("users/" + currentUser.id).set(currentUser);
            showPopup("একই ফোন থেকে রেফারেল গ্রহণযোগ্য নয়।");
        }
        updateUI();
        loadNews();
    });
}

function updateUI() {
    document.getElementById("user-name-display").innerText = currentUser.name;
    document.getElementById("user-username-display").innerText = "@" + currentUser.username;
    document.getElementById("current-balance").innerText = "৳" + (currentUser.balance || 0);
    document.getElementById("total-referrals").innerText = currentUser.referrals || 0;
    document.getElementById("user-country").innerText = currentUser.country === "Bangladesh" ? "BD" : "INT";

    const link = `https://t.me/Headline_newsbot?start=${currentUser.id}`;
    document.getElementById("referral-link").innerText = link;

    document.getElementById("copy-btn").onclick = () => {
        navigator.clipboard.writeText(link);
        showPopup("লিংক কপি হয়েছে!");
    };
    document.getElementById("share-btn").onclick = () => {
        Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
    };
}

function loadNews() {
    db.ref("news").orderByChild("timestamp").limitToLast(5).on("value", snap => {
        const container = document.getElementById("latest-news-list");
        container.innerHTML = "";
        Object.values(snap.val() || {}).reverse().forEach(n => {
            const card = document.createElement("div");
            card.className = "news-card";
            card.style.cssText = "flex: 0 0 70%; max-width: 70%; background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
            card.onclick = () => location.href = `news.html?id=${n.id}`;
            card.innerHTML = `
                <img src="${n.imageUrl}" style="width:100%; height:100px; object-fit:cover; border-top-left-radius:10px; border-top-right-radius:10px;">
                <div style="padding:10px;">
                    <h4 style="font-size:14px; margin-bottom:5px;">${n.title}</h4>
                    <p style="font-size:12px; color:#666;">${n.description.substring(0,70)}...</p>
                    <small>Earn ৳${n.points} • ${Math.ceil(n.readTime/60)} মিনিট</small>
                </div>`;
            container.appendChild(card);
        });
    });
}

initUser();