const firebaseConfig = {
    // ... (আপনার Firebase কনফিগ যেমন আছে তেমন থাকবে) ...
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

const CURRENCY_RATES = {
    'BDT': { symbol: '৳', rate: 110.00 },
    'USD': { symbol: '$', rate: 1 },
    'INR': { symbol: '₹', rate: 83.50 },
    'PKR': { symbol: 'Rs', rate: 279.00 }
};
const POINT_VALUE_USD = 0.01; 
const MIN_CONVERT_POINTS = 1000;

async function getLiveExchangeRates() {
    return CURRENCY_RATES;
}

async function convertUSDToCurrency(usdValue, currencyCode) {
    const rates = await getLiveExchangeRates();
    // যদি কারেন্সি কোড না পাওয়া যায়, তবে USD ব্যবহার করবে
    const rateData = rates[currencyCode] || rates['USD']; 
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


function loadProfileData() {
    if (!window.Telegram?.WebApp) return alert("টেলিগ্রাম থেকে খুলুন!");

    Telegram.WebApp.ready();
    const tg = Telegram.WebApp.initDataUnsafe;
    const user = tg.user || { id: Date.now(), first_name: "Guest" };

    userId = user.id.toString();

    document.getElementById("profile-name").innerText = user.first_name + (user.last_name ? " " + user.last_name : "");
    document.getElementById("profile-username").innerText = user.username ? "@" + user.username : "@user" + user.id;
    document.getElementById("user-id").innerText = user.id;
    if (user.photo_url) {
        document.getElementById("profile-photo").src = user.photo_url;
    }

    // 💡 ফিক্স: কারেন্সি সেটিং অনচেঞ্জ লজিককে আগে নিয়ে আসা হলো
    const selector = document.getElementById("currency-selector-profile");
    if (selector) {
        // সেটিং পরিবর্তন হলে সাথে সাথে Firebase-এ সেভ হবে
        selector.onchange = function() {
            db.ref("users/" + userId).update({ currency: this.value });
        };
    }

    // ✅ Firebase রিয়েল-টাইম ডেটা লিসেনার
    db.ref("users/" + userId).on("value", async snap => {
        const data = snap.val() || {};
        
        // ✅ চূড়ান্ত ফিক্স: সেভ করা কারেন্সি লোড নিশ্চিত করা।
        // যদি Firebase-এ কারেন্সি সেভ না থাকে, তবে 'BDT' ডিফল্ট হিসেবে ধরবে।
        const userCurrency = data.currency || 'BDT';
        const userPoints = data.points || 0;
        
        // **********************************************
        // ✅ ফিক্সড: লোড হওয়া সেটিং দিয়েই সিলেক্টর আপডেট করা (Persistence Fix)
        if (selector) {
            selector.value = userCurrency; // সেভ করা কারেন্সি সিলেক্ট করবে
        }
        // **********************************************

        // UI আপডেট লজিক
        const convertedBalance = await convertUSDToCurrency(data.balance || 0, userCurrency);
        const pointsUSDValue = convertPointsToUSD(userPoints);
        const convertedPointsValue = await convertUSDToCurrency(pointsUSDValue, userCurrency);

        // ✅ ব্যালেন্স ডিসপ্লে আপডেট
        document.getElementById("current-balance-symbol").innerText = convertedBalance.symbol;
        document.getElementById("current-balance-value").innerText = convertedBalance.value;
        document.getElementById("current-balance-code").innerText = `(${convertedBalance.code})`;

        document.getElementById("total-referrals").innerText = (data.referrals || 0) + " Users";
        document.getElementById("user-country").innerText = data.country || "Bangladesh";
        
        // ✅ পয়েন্ট ভ্যালু ডিসপ্লে আপডেট
        document.getElementById("total-points-count").innerText = userPoints.toLocaleString();
        document.getElementById("total-points-value-symbol").innerText = convertedPointsValue.symbol;
        document.getElementById("total-points-value").innerText = convertedPointsValue.value;

        // কনভার্ট বাটনের লজিক
        const maxPointsDisplay = document.getElementById("max-points");
        const pointsInput = document.getElementById("points-to-convert");

        if (maxPointsDisplay) maxPointsDisplay.innerText = userPoints.toLocaleString();
        if (pointsInput) pointsInput.max = userPoints;
        
        pointsInput?.oninput();
    });
    
    // 💡 পয়েন্ট কনভার্ট ইনপুট হ্যান্ডলার 
    const pointsInput = document.getElementById("points-to-convert");
    const resultDisplay = document.getElementById("conversion-result");
    if (pointsInput && resultDisplay) {
        pointsInput.oninput = async function() {
            let points = parseInt(this.value) || 0;
            // ✅ ফিক্সড: কারেন্সি সেটিং থেকে কারেন্সি কোড নেওয়া
            const userCurrency = document.getElementById("currency-selector-profile").value; 
            
            if (points > parseInt(this.max)) {
                points = parseInt(this.max);
                this.value = points;
            }
            
            const usdValue = convertPointsToUSD(points);
            const converted = await convertUSDToCurrency(usdValue, userCurrency); 
            
            resultDisplay.innerText = `You will get ${converted.symbol}${converted.value} (${converted.code}) for $${usdValue.toFixed(4)} USD`;
            document.getElementById("convert-btn").disabled = (points < MIN_CONVERT_POINTS);
        };
    }

    // কনভার্ট বাটন ক্লিক হ্যান্ডলার
    const convertBtn = document.getElementById("convert-btn");
    if (convertBtn) {
        convertBtn.onclick = handlePointConversion;
    }
}

function handlePointConversion() {
    const pointsInput = document.getElementById("points-to-convert");
    let pointsToConvert = parseInt(pointsInput.value) || 0;
    
    if (pointsToConvert < MIN_CONVERT_POINTS) {
        alert(`Minimum conversion is ${MIN_CONVERT_POINTS} Points.`);
        return;
    }
    
    db.ref("users/" + userId).once("value").then(snap => {
        const data = snap.val();
        const currentPoints = data.points || 0;
        
        if (pointsToConvert > currentPoints) {
            alert("Insufficient Points.");
            return;
        }
        
        const usdGain = convertPointsToUSD(pointsToConvert);
        
        // 1. Points কাটানো
        db.ref("users/" + userId + "/points").transaction(v => (v || 0) - pointsToConvert);
        
        // 2. মেইন ব্যালেন্স (USD) যোগ করা
        db.ref("users/" + userId + "/balance").transaction(v => (v || 0) + usdGain);
        
        alert(`${pointsToConvert} Points successfully converted to $${usdGain.toFixed(4)} USD!`);
        pointsInput.value = ''; 
    });
}


function openSupport() {
    Telegram.WebApp.openTelegramLink("https://t.me/Headline_newsbot"); 
}

function logout() {
    document.getElementById("logout-popup").style.display = "flex";
}

function confirmLogout() {
    localStorage.clear();
    Telegram.WebApp.close();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.Telegram && window.Telegram.WebApp) {
        // Telegram Web App রেডি হলেই ডেটা লোড শুরু হবে
        Telegram.WebApp.ready(loadProfileData);
    } else {
        loadProfileData();
    }
});
