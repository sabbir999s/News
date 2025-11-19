// আপনার AdsGram ব্লক আইডি এখানে বসান
const VIDEO_BLOCK_ID = "17904"; 
const INTERSTITIAL_BLOCK_ID = "int-17904";

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
const rtdb = firebase.database(); 
const db = firebase.firestore(); 

// ----------------------------------------------------------------------------------
// 💡 ADSGRAM ইনিশিয়ালাইজেশন এবং ইউটিলিটি ফাংশন
// ----------------------------------------------------------------------------------

// Adsgram AdController তৈরি করা
let VideoAdController;
let InterstitialAdController;

if (window.Adsgram) {
    // Rewarded (Video Ad) কন্ট্রোলার, যেটি Earn Now/View News এ ক্লিক করলে দেখাবে
    VideoAdController = window.Adsgram.init({ blockId: VIDEO_BLOCK_ID });
    
    // Interstitial (Instant/Skipable Ad) কন্ট্রোলার, যেটি Complete/Close এ ক্লিক করলে দেখাবে
    InterstitialAdController = window.Adsgram.init({ blockId: INTERSTITIAL_BLOCK_ID });
}

// স্থায়ী ইউজার আইডি ফিক্স
let currentUser = localStorage.getItem('newsApp_guestId'); 

if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    currentUser = Telegram.WebApp.initDataUnsafe.user?.id?.toString() || 'tg_user_id';
} else if (!currentUser) {
    currentUser = "guest_" + Date.now();
    localStorage.setItem('newsApp_guestId', currentUser);
} 
// ----------------------------------------------------------------------------------

let currentTask = null;
let timer = 0;
let timerInterval = null;
let isEarningAttempt = false; 

// ----------------------------------------------------------------------------------
// 💡 AdsGram ফ্লো ফাংশন
// ----------------------------------------------------------------------------------

// Earn Now/View News এ ক্লিক করার ফ্লো (ভিডিও বিজ্ঞাপন)
async function startTaskFlow(id) {
    const doc = await db.collection("news").doc(id).get();
    if (!doc.exists) return; 

    currentTask = {...doc.data(), id: doc.id}; 

    // অ্যাড দেখানোর লজিক
    if (VideoAdController) {
        VideoAdController.show()
            .then(() => {
                // ভিডিও দেখা শেষ বা বন্ধ হলেও টাস্ক শুরু হবে
                console.log("Video Ad complete/closed. Starting task.");
                startTaskFirestore(id);
            })
            .catch((error) => {
                // অ্যাড লোড বা প্লে না হলে সরাসরি টাস্ক শুরু হবে (টাকা মিস হবে না)
                console.error("Video Ad Error, continuing task:", error);
                startTaskFirestore(id);
            });
    } else {
        // যদি Adsgram লোড না হয়, সরাসরি টাস্ক শুরু
        startTaskFirestore(id);
    }
}

// টাস্ক কমপ্লিট বা Close করার ফ্লো (ইন্টারস্টিশিয়াল বিজ্ঞাপন)
function handleExitFlow(onAdFinished) {
    if (InterstitialAdController) {
        InterstitialAdController.show()
            .then(() => {
                // অ্যাড দেখা শেষ বা বন্ধ হলে মূল ফাংশন চলবে
                console.log("Interstitial Ad complete/closed. Executing exit action.");
                onAdFinished();
            })
            .catch((error) => {
                // অ্যাড লোড বা প্লে না হলে মূল ফাংশন সরাসরি চলবে
                console.error("Interstitial Ad Error, continuing exit action:", error);
                onAdFinished();
            });
    } else {
        // যদি Adsgram লোড না হয়, সরাসরি মূল ফাংশন চলবে
        onAdFinished();
    }
}


// ----------------------------------------------------------------------------------
// 💡 নতুন Firestore-ভিত্তিক ডেটা লোডিং ফাংশন
// ----------------------------------------------------------------------------------
function loadNewsFirestore() {
    db.collection("news").orderBy("timestamp", "desc").onSnapshot(snap => {
        const container = document.getElementById("news-task-list");
        container.innerHTML = "";
        
        snap.forEach(doc => {
            const n = doc.data();
            const readKey = `read_${currentUser}_${doc.id}`; 
            const already = localStorage.getItem(readKey);
            
            // 💡 বাটন এবং তথ্য প্রদর্শনের লজিক (তালিকা)
            const buttonText = already ? "View News" : "Earn Now";
            const earnInfoHTML = already ? "" : `
                <div class="earn-info">
                    <strong>৳${n.points}</strong> • ${Math.ceil(n.readTime/60)} min
                </div>`;
            
            // ইমেজ লোডিং ফিক্স (onerror সহ)
            container.innerHTML += `
                <div class="news-earn-card">
                    <img src="${n.imageUrl}" class="news-image" onerror="this.src='https://via.placeholder.com/400x140/6a5acd/white?text=Image+Load+Failed'" loading="lazy">
                    <div class="news-content">
                        <h3 class="news-title">${n.title}</h3>
                        <p class="news-description">${n.description}</p>
                        <div class="task-footer">
                            <button class="btn-earn" onclick="startTaskFlow('${doc.id}')"> 
                                ${buttonText}
                            </button>
                            ${earnInfoHTML}
                        </div>
                    </div>
                </div>`;
        });
        
        // 💡 বটম ব্যানার অ্যাড এর জন্য জায়গা
        // ধরে নেওয়া হলো আপনার news.html এ <div id="ad-banner-bottom"></div> আছে
        const bottomAdContainer = document.getElementById("ad-banner-bottom");
        if (bottomAdContainer) {
             // ⚠️ এখানে আপনার AdsGram ব্যানার অ্যাড কোড বসান
             bottomAdContainer.innerHTML = '';
        }
    });
}

// 💡 নতুন Firestore-ভিত্তিক startTask ফাংশন
async function startTaskFirestore(id) {
    const readKey = `read_${currentUser}_${currentTask.id}`; 
    const alreadyRead = localStorage.getItem(readKey);

    // মোড নির্ধারণ করা
    isEarningAttempt = !alreadyRead; 
    
    const timerDisplay = document.getElementById("timer-display");
    const completeBtn = document.getElementById("complete-btn");

    if (isEarningAttempt) {
        // EARN MODE: টাইমার ও বাটন শো করবে, টাইমার সেট হবে
        timer = currentTask.readTime;
        timerDisplay.style.display = 'block'; 
        completeBtn.style.display = 'block'; 
        completeBtn.disabled = true; 
        timerDisplay.innerText = `Time: 00:00`;
        
    } else {
        // VIEW MODE: টাইমার ও বাটন হাইড থাকবে, পেমেন্ট হবে না
        timer = 0;
        clearInterval(timerInterval);
        timerInterval = null;
        timerDisplay.style.display = 'none'; 
        completeBtn.style.display = 'none'; 
    }
    
    document.getElementById("task-modal").style.display = "block";
    
    const iframe = document.getElementById("news-iframe");
    iframe.src = "about:blank"; 
    
    // iframe লোড করা
    iframe.src = currentTask.link;

    if (isEarningAttempt) {
        // শুধুমাত্র Earn Mode-এ টাইমার চালু হবে
        iframe.onload = function() {
            if (isEarningAttempt) {
                timerDisplay.innerText = `Time: ${formatTime(currentTask.readTime)}`;
                startTimer();
            }
        };
        
        // 5 সেকেন্ড ফলব্যাক (যদি iframe লোড না হয়)
        setTimeout(() => {
            if (isEarningAttempt && completeBtn.disabled && timerInterval === null) {
                timerDisplay.innerText = `Time: ${formatTime(currentTask.readTime)}`;
                startTimer();
            }
        }, 5000); 
    }
}


// ----------------------------------------------------------------------------------
// 💡 পুরাতন RTDB ফাংশনগুলি (পরিবর্তন করা হয়নি)
// ----------------------------------------------------------------------------------
function loadNews() {
    loadNewsFirestore(); 
}

function startTask(id) {
    startTaskFlow(id);
}
// ----------------------------------------------------------------------------------


function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer-display").innerText = `Time: ${formatTime(timer)}`;
        
        if (timer <= 0) {
            clearInterval(timerInterval);
            timerInterval = null; 
            document.getElementById("complete-btn").disabled = false;
            document.getElementById("complete-btn").onclick = completeTask;
            document.getElementById("timer-display").innerText = "Completed!";
        } else {
            document.getElementById("complete-btn").disabled = true;
        }
    }, 1000);
}

function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

function completeTask() {
    // 💡 টাস্ক কমপ্লিট বাটনে ক্লিক করলে অ্যাড শো করবে
    handleExitFlow(() => {
        // অ্যাড শেষ হওয়ার পর টাকা অ্যাড হবে
        if (isEarningAttempt) {
            localStorage.setItem(`read_${currentUser}_${currentTask.id}`, "true");
            document.getElementById("earn-message").innerText = `অভিনন্দন! ৳${currentTask.points} পেয়েছেন!`;
            document.getElementById("success-popup").style.display = "flex";
            
            // টাকা অ্যাড হওয়ার জন্য সময়
            setTimeout(() => {
                document.getElementById("success-popup").style.display = "none";
                closeTask(false); // Close করার সময় যেন ডবল অ্যাড না দেখায়
                loadNews(); 
            }, 3000);
        } else {
            // View Mode-এ ক্লিক করলে শুধু টাস্ক বন্ধ হবে
            closeTask(false); // Close করার সময় যেন ডবল অ্যাড না দেখায়
        }
    });
}

function closeTask(showAd = true) {
    // 💡 ক্লোজ বাটনে ক্লিক করলে অ্যাড শো করবে (যদি না কমপ্লিট টাস্ক থেকে কল হয়)
    if (showAd) {
        handleExitFlow(() => {
            clearInterval(timerInterval);
            timerInterval = null; 
            document.getElementById("task-modal").style.display = "none";
            document.getElementById("news-iframe").src = "about:blank";
        });
    } else {
        clearInterval(timerInterval);
        timerInterval = null; 
        document.getElementById("task-modal").style.display = "none";
        document.getElementById("news-iframe").src = "about:blank";
    }
}

// 💡 ফাংশন ওভাররাইড
loadNews = loadNewsFirestore;
startTask = startTaskFlow; 

loadNews();
