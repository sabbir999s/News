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
// ✅ Firebase.database() এর বদলে Firestore ব্যবহার করা হলো
const db = firebase.firestore();

let currentUser = null;
let deviceId = "";

const CURRENCY_RATES = {
    'BDT': { symbol: '৳', rate: 110.00 },
    'USD': { symbol: '$', rate: 1 },
    'INR': { symbol: '₹', rate: 83.50 },
    'PKR': { symbol: 'Rs', rate: 279.00 }
};
const POINT_VALUE_USD = 0.01; 
// ... (Helper functions like getLiveExchangeRates, convertUSDToCurrency, convertPointsToUSD, getDeviceId, showPopup remain the same) ...
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

    // ✅ ফিক্স: যদি Telegram photo না পাওয়া যায়, তবে একটি ডিফল্ট ছবি সেট করা হলো
    if (!currentUser.photo) {
        document.getElementById("user-photo").src = "https://via.placeholder.com/80?text=TG";
    } else {
        if (currentUser.photo) document.getElementById("user-photo").src = currentUser.photo;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get("start");

    // ✅ Firestore লিসেনার: .onSnapshot ব্যবহার করা হয়েছে রিয়েল-টাইম আপডেটের জন্য
    db.collection("users").doc(currentUser.id).onSnapshot(doc => {
        const exists = doc.exists;
        const data = doc.data();

        if (exists) {
            const updatedUser = {
                ...data, // Firestore ডেটা আগে লোড
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo,
                country: currentUser.country,
                balance: data.balance || 0,
                points: data.points || 0,
                currency: data.currency || 'BDT' 
            };
            currentUser = updatedUser;
            
            // রিয়েল-টাইম আপডেট Firestore এ .set() বা .update() দিয়ে
            db.collection("users").doc(currentUser.id).update({
                name: currentUser.name,
                username: currentUser.username,
                photo: currentUser.photo,
                country: currentUser.country
            });
            
            updateUI(); 
            loadNews();
        } else {
            // ✅ Firestore: নতুন ইউজার সেভ করার লজিক
            
            let initialUser = { ...currentUser };
            let isNewUser = true;
            
            // ✅ ফিক্স: ডিভাইস আইডি এবং টাইমস্ট্যাম্প নিশ্চিত করা হলো
            initialUser.deviceId = deviceId; 
            initialUser.createdAt = firebase.firestore.FieldValue.serverTimestamp(); 
            // ফিক্স শেষ: এই কোডগুলি ইউজার ক্রেড হওয়া নিশ্চিত করবে

            if (refId && refId !== currentUser.id) {
                const bonus = 0.05; 
                initialUser.balance = bonus; 
                giveReferralBonus(refId); // রেফারেল বোনাস লজিক
                showPopup("স্বাগতম ও রেফারেল বোনাস! আপনি $0.05 USD পেয়েছেন!");
            } else if (isNewUser) {
                showPopup("স্বাগতম! রেফারেল ছাড়া জয়েন করেছেন।");
            }

            db.collection("users").doc(currentUser.id).set(initialUser)
              .then(() => {
                currentUser = initialUser;
                updateUI();
                loadNews();
              })
              .catch(error => {
                console.error("Firestore Set Error: ", error);
                alert("Firestore Error: ডেটা সেভ হয়নি।");
              });
        }
    }, error => {
        console.error("Firestore Snapshot Error: ", error);
    });
}

function giveReferralBonus(refId) {
    const bonus = 0.05; 
    const referrerRef = db.collection("users").doc(refId);

    // Firestore Transaction ব্যবহার করে ব্যালেন্স ও রেফারেল সংখ্যা আপডেট
    db.runTransaction(transaction => {
        return transaction.get(referrerRef).then(doc => {
            if (doc.exists) {
                const referrerData = doc.data();
                if (referrerData.deviceId !== deviceId) {
                    const newBalance = (referrerData.balance || 0) + bonus;
                    const newReferrals = (referrerData.referrals || 0) + 1;
                    transaction.update(referrerRef, { balance: newBalance, referrals: newReferrals });
                }
            }
        });
    }).then(() => {
        console.log("Referral Transaction successful");
    }).catch(error => {
        console.error("Referral Transaction failed: ", error);
    });
}

// ... (updateUI function remains the same, it uses currentUser data) ...
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
    
    // ✅ ফিক্স: রেফারেল লিংক শেয়ার করার জন্য আরো নির্ভরযোগ্য কোড যোগ
    document.getElementById("share-btn").onclick = () => {
        const shareText = `💰 Join me on Headline News Mini App and earn! Use my referral link: ${link}`; // শেয়ার করার জন্য কাস্টম টেক্সট
        Telegram.WebApp.openTelegramLink(`https://t.me/share/url?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`);
    };
}

function loadNews() {
    // ✅ Firestore: news collection থেকে ডেটা লোড
    db.collection("news").orderBy("timestamp", "desc").limit(5).onSnapshot(snap => {
        const container = document.getElementById("latest-news-list");
        container.innerHTML = "";
        
        snap.docs.forEach(doc => {
            const n = doc.data();
            const card = document.createElement("div");
            card.className = "news-card";
            card.onclick = () => location.href = `news.html?id=${doc.id}`; // doc.id ব্যবহার করা হলো
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


document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        Telegram.WebApp.ready(initUser);
    } else {
        initUser();
    }
});
