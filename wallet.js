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

// ইউজার আইডি নেওয়া
if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    userId = Telegram.WebApp.initDataUnsafe.user.id.toString();
}

// তোর আসল ফাংশন — কোনো চেঞ্জ নাই
function togglePaymentFields() {
    const method = document.getElementById('payment-method').value;
    document.getElementById('bank-fields').classList.add('hidden');
    document.getElementById('crypto-fields').classList.add('hidden');

    if (method === 'bank') {
        document.getElementById('bank-fields').classList.remove('hidden');
    } else if (method === 'crypto') {
        document.getElementById('crypto-fields').classList.remove('hidden');
    }
}

function validateNumber(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 10) v = v.substring(0,10);
    if (v[0].includes(v[0])) v = v.substring(1);
    input.value = v;
}

function pasteAddress() {
    navigator.clipboard.readText().then(t => {
        document.getElementById('wallet-address').value = t;
    }).catch(() => alert("পেস্ট করা যায়নি"));
}

// রিয়েল উইথড্র রিকোয়েস্ট
async function submitWithdrawRequest() {
    const method = document.getElementById('payment-method').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value || 0);

    if (!method || amount < 10) return alert("মিনিমাম ১০ ডলার");

    let details = {};
    if (method === "bank") {
        const num = document.getElementById("phone-number").value;
        if (num.length !== 10) return alert("১০ ডিজিট দিন");
        details = { type: document.getElementById("bank-type").value, number: "+880"+num };
    } else {
        const addr = document.getElementById("wallet-address").value.trim();
        if (addr.length < 20) return alert("সঠিক এড্রেস দিন");
        details = { network: document.getElementById("crypto-network").value, address: addr };
    }

    const trx = "TXN-"+Date.now().toString(36).toUpperCase();

    await db.ref("withdrawals/"+trx).set({
        userId, amount, details, status:"pending", trxId: trx, timestamp: Date.now()
    });

    document.getElementById("popup-text").innerHTML = `সফল!<br>Trx ID: ${trx}`;
    document.getElementById("popup").style.display = "flex";
    setTimeout(() => document.getElementById("popup").style.display = "none", 4000);

    // ফর্ম রিসেট
    document.getElementById("payment-method").value = "";
    togglePaymentFields();
    document.getElementById("withdraw-amount").value = "";
}

// রিয়েল ব্যালেন্স লোড
db.ref("users/"+userId+"/balance").on("value", s => {
    const bal = s.val() || 0;
    document.getElementById("current-balance").innerText = "৳" + bal;
});

// রিয়েল হিস্টোরি লোড
db.ref("withdrawals").orderByChild("userId").equalTo(userId).on("value", s => {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    if (!s.val()) {
        list.innerHTML = "<p style='text-align:center;color:#999'>কোনো রিকোয়েস্ট নেই</p>";
        return;
    }
    Object.values(s.val()).reverse().forEach(w => {
        const st = w.status === "paid" ? "Paid" : w.status === "rejected" ? "Rejected" : "Pending";
        const cls = w.status === "paid" ? "status-paid" : w.status === "rejected" ? "status-rejected" : "status-pending";
        list.innerHTML += `
            <div class="history-item">
                <div>
                    <small style="color:#999">Trx ID: ${w.trxId}</small>
                    <p>${w.details.type || w.details.network} ${w.details.number || w.details.address.substring(0,12)+"..."}</p>
                </div>
                <div style="text-align:right">
                    <p style="font-weight:bold;color:#6a5acd">$${w.amount}</p>
                    <span class="status-tag ${cls}">${st}</span>
                </div>
            </div>`;
    });
});