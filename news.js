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

let currentUser = "guest_" + Date.now();
let currentTask = null;
let timer = 0;
let timerInterval = null;

if (window.Telegram?.WebApp) {
    Telegram.WebApp.ready();
    currentUser = Telegram.WebApp.initDataUnsafe.user?.id?.toString() || currentUser;
}

function loadNews() {
    rtdb.ref("news").orderByChild("timestamp").on("value", snap => {
        const container = document.getElementById("news-task-list");
        container.innerHTML = "";
        const list = [];
        snap.forEach(child => list.push(child.val()));
        list.sort((a, b) => b.timestamp - a.timestamp);

        list.forEach(n => {
            const readKey = `read_${currentUser}_${n.id}`;
            const already = localStorage.getItem(readKey);
            container.innerHTML += `
                <div class="news-earn-card">
                    <img src="${n.imageUrl}" class="news-image" onerror="this.src='https://via.placeholder.com/400x140/6a5acd/white?text=No+Image'">
                    <div class="news-content">
                        <h3 class="news-title">${n.title}</h3>
                        <p class="news-description">${n.description}</p>
                        <div class="task-footer">
                            <button class="btn-earn" onclick="startTask('${n.id}')">
                                ${already ? "Read Again" : "Earn Now"}
                            </button>
                            <div class="earn-info">
                                <strong>৳${n.points}</strong> • ${Math.ceil(n.readTime/60)} min
                            </div>
                        </div>
                    </div>
                </div>`;
        });
    });
}

function startTask(id) {
    rtdb.ref("news/" + id).once("value").then(s => {
        currentTask = s.val();
        timer = currentTask.readTime;
        document.getElementById("timer-display").innerText = `Time: ${formatTime(timer)}`;
        document.getElementById("news-iframe").src = currentTask.link;
        document.getElementById("task-modal").style.display = "block";
        startTimer();
    });
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer--;
        document.getElementById("timer-display").innerText = `Time: ${formatTime(timer)}`;
        if (timer <= 0) {
            clearInterval(timerInterval);
            document.getElementById("complete-btn").disabled = false;
            document.getElementById("complete-btn").onclick = completeTask;
        }
    }, 1000);
}

function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

function completeTask() {
    localStorage.setItem(`read_${currentUser}_${currentTask.id}`, "true");
    document.getElementById("earn-message").innerText = `অভিনন্দন! ৳${currentTask.points} পেয়েছেন!`;
    document.getElementById("success-popup").style.display = "flex";
    setTimeout(() => {
        document.getElementById("success-popup").style.display = "none";
        closeTask();
    }, 3000);
}

function closeTask() {
    clearInterval(timerInterval);
    document.getElementById("task-modal").style.display = "none";
    document.getElementById("news-iframe").src = "about:blank";
}

loadNews();