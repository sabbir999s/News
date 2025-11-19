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

const CURRENCY_RATES = {
    'BDT': { symbol: '৳', rate: 110.00 },
    'USD': { symbol: '$', rate: 1 },
    'INR': { symbol: '₹', rate: 83.50 },
    'PKR': { symbol: 'Rs', rate: 279.00 }
};
const POINT_VALUE_USD = 0.01; 

async function getLiveExchangeRates() {
    return CURRENCY_RATES;
}

async function convertUSDToCurrency(usdValue, currencyCode) {
    const rates = await getLiveExchangeRates();
    const rateData = rates[currencyCode] || rates['BDT'];
    const convertedValue = usdValue * rateData.rate;
    return {
        value: convertedValue.toFixed(2),
        symbol: rateData.symbol,
        code: currencyCode
    };
}

function convertPointsToUSD(points) {
    return (points / 1000) * POINT_VALUE_USD;
}

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

function showPopup(msg) {
    document.getElementById("popup-message").innerText = msg;
    document.getElementById("popup").style.display = "flex";
    setTimeout(() => document.getElementById("popup").style.display = "none", 3000);
}

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
        joinTime: Date.now(),
        points: 0, 
        currency: 'BDT' 
    };

    if (currentUser.photo) document.getElementById("user-photo").src = currentUser.photo;

    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("start");

    db.ref("users/" + currentUser.id).on("value", snap => {
        const exists = snap.val();
        if (exists) {
            const updatedUser = {
                ...exists,
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo,
                country: currentUser.country,
                balance: exists.balance || 0,
                points: exists.points || 0,
                // ✅ সেভ করা কারেন্সি লোড হচ্ছে
                currency: exists.currency || 'BDT' 
            };
            currentUser = updatedUser;
            
            db.ref("users/" + currentUser.id).update({
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo,
                country: currentUser.country
            });
            
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

function giveReferralBonus(refId) {
    const bonus = 0.05; 
    db.ref("users/" + refId).once("value").then(snap => {
        const referrer = snap.val();
        if (referrer && referrer.deviceId !== deviceId) {
            db.ref("users/" + refId + "/balance").transaction(v => (v || 0) + bonus);
            db.ref("users/" + refId + "/referrals").transaction(v => (v || 0) + 1);
            currentUser.balance = bonus;
            db.ref("users/" + currentUser.id).set(currentUser);
            showPopup("রেফারেল বোনাস! আপনি পেয়েছেন $0.05 USD!");
        } else {
            db.ref("users/" + currentUser.id).set(currentUser);
            showPopup("একই ফোন থেকে রেফারেল গ্রহণযোগ্য নয়।");
        }
        updateUI();
        loadNews();
    });
}

// ✅ চূড়ান্ত ফিক্স: হোম পেজে প্রতীক ও মান আলাদাভাবে আপডেট করা
async function updateUI() {
    document.getElementById("user-name-display").innerText = currentUser.name;
    document.getElementById("user-username-display").innerText = "@" + currentUser.username;
    
    // সেভ করা কারেন্সি দিয়ে কনভার্ট
    const convertedBalance = await convertUSDToCurrency(currentUser.balance || 0, currentUser.currency);
    const pointsUSDValue = convertPointsToUSD(currentUser.points || 0);
    const convertedPointsValue = await convertUSDToCurrency(pointsUSDValue, currentUser.currency);

    // ✅ ব্যালেন্স আপডেট
    document.getElementById("converted-balance-symbol-home").innerText = convertedBalance.symbol; 
    document.getElementById("converted-balance-value-home").innerText = convertedBalance.value; 
    document.getElementById("balance-currency-code").innerText = convertedBalance.code;
    
    // ✅ পয়েন্টস আনুমানিক মূল্য আপডেট
    document.getElementById("points-approx-symbol").innerText = convertedPointsValue.symbol; 
    document.getElementById("points-approx-value").innerText = convertedPointsValue.value; 
    document.getElementById("current-points").innerText = `${(currentUser.points || 0).toLocaleString()} (Unconverted)`; 
    
    // অন্যান্য UI আপডেট
    document.getElementById("user-country-short").innerText = currentUser.country === "Bangladesh" ? "BD" : "INT";
    document.getElementById("total-referrals-home").innerText = currentUser.referrals || 0;

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
            card.onclick = () => location.href = `news.html?id=${n.id}`;
            card.innerHTML = `
                <img src="${n.imageUrl}" alt="News Image">
                <div class="news-card-content">
                    <h4>${n.title}</h4>
                    <p>${n.description.substring(0,70)}...</p>
                    <small>Earn ${n.points || 0} Points • ${Math.ceil(n.readTime/60)} মিনিট</small>
                </div>`;
            container.appendChild(card);
        });
    });
}

initUser();

// ... (DOM Content Loaded handler) ...
document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready(initUser);
    } else {
        initUser();
    }
});
