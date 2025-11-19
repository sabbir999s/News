Const firebaseConfig = {
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
    // START: এই লাইনে একটি ছোট পরিবর্তন (যদি window.Telegram লোড না হয় তবে alert দেখাবে)। 
    // এই ফাংশনটি এখন শুধুমাত্র Telegram.WebApp.ready() এর পরে কল হবে।
    // আপনার মূল লাইন (যেমন আছে তেমন থাকুক, তবে কার্যকারিতা এখন ভিন্ন হবে):
    if (!window.Telegram?.WebApp) return alert("টেলিগ্রাম থেকে খুলুন!");
    
    // START: এই লাইনটিকে হুবহু অপরিবর্তিত রেখে দিন, কারণ এর পরের লাইনটি পরিবর্তন হবে।
    Telegram.WebApp.ready();
    // END: এই লাইনটিকে হুবহু অপরিবর্তিত রেখে দিন।
    
    // START: আপনার মূল কোডের এই লাইনটিতে পরিবর্তন ঘষাতে হবে
    // আপনার বিদ্যমান লাইন:
    // const tg = Telegram.WebApp.initDataUnsafe;
    // const user = tg.user || { id: Date.now(), first_name: "Guest" };
    
    // এটিকে পরিবর্তন করে নিম্নলিখিত দুটি লাইন যুক্ত করুন (একই জায়গায় প্রতিস্থাপন করুন):
    const tg = Telegram.WebApp.initDataUnsafe;
    const user = tg.user || { id: Date.now(), first_name: "Guest" };
    
    // END: আপনার মূল কোডের এই লাইনটিতে পরিবর্তন ঘষাতে হবে


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
            // START: 💡 ফিক্স ২ - ইউজার ডেটা আপডেট লজিক যোগ করা হলো
            // বর্তমান টেলিগ্রাম ডেটা (নাম, ইউজারনেম, ছবি) অক্ষত রেখে Firebase-এর ব্যালেন্স ও রেফারেল যোগ করা
            const updatedUser = {
                ...currentUser, 
                ...exists,
                // নিশ্চিত করা যে টেলিগ্রামের বর্তমান নাম/ইউজারনেম/ছবি সেভ হোক
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo,
                // ডিভাইস আইডি ও জয়েন টাইম যেন পরিবর্তিত না হয়
                deviceId: exists.deviceId,
                joinTime: exists.joinTime
            };
            currentUser = updatedUser;
            // পরিবর্তিত ডেটা Firebase এ আপডেট করা হলো
            db.ref("users/" + currentUser.id).update({
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo
            });
            // END: 💡 ফিক্স ২
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

// START: এই লাইনটি আপনার মূল কোড থেকে যেমন আছে তেমন রেখে দিন।
initUser();
// END: এই লাইনটি আপনার মূল কোড থেকে যেমন আছে তেমন রেখে দিন।


// START: Telegram WebApp লোড হওয়া নিশ্চিত করার জন্য এই অতিরিক্ত কোডটুকু একদম নিচে ঘষান।
// এটি আপনার বর্তমান initUser() ফাংশনটিকে সঠিক সময়ে কল করার কাজটি নিশ্চিত করবে।
// 💡 ফিক্স ১: সঠিক সময়ে initUser কল করার ব্যবস্থা
if (window.Telegram && window.Telegram.WebApp) {
    // Telegram WebApp রেডি হলে তবেই initUser কল হবে।
    window.onload = function() {
        Telegram.WebApp.ready(() => {
            // ডাবল কল এড়াতে একটি চেকার যোগ করা হলো, যা শুধুমাত্র এই নতুন কোডে যোগ হচ্ছে।
            if (!window._initUserCalled) {
                initUser();
                window._initUserCalled = true;
            }
        });
    };
} else {
    // যদি টেলিগ্রাম অবজেক্ট না পাওয়া যায় (ব্রাউজার বা কোড স্টুডিও), তাহলেও initUser কল হবে।
    // তবে initUser() এর ভেতরের alert চলবে।
    window.onload = function() {
        if (!window._initUserCalled) {
            initUser();
            window._initUserCalled = true;
        }
    };
}
// END: এই অতিরিক্ত কোডটুকু একদম নিচে ঘষান।
