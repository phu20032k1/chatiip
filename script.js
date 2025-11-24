// ⭐  Tự động bật news-mode nếu reload trực tiếp URL /news/slug
if (location.pathname.startsWith("/news/")) {
    document.body.classList.add("news-mode");
}
// ============================================================

function jsonToIndustrialTableV2(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return "<p>Không có dữ liệu.</p>";
    }

    // ⭐ TỰ ĐỘNG ÁNH XẠ KEY TIẾNG VIỆT → KEY CHUẨN
    function normalize(item) {
        return {
            name: item["Tên"] || item["ten"] || item["Name"] || item.name || "",
            address: item["Địa chỉ"] || item["diachi"] || item["Address"] || item.address || "",
            area: item["Tổng diện tích"] || item["dien_tich"] || item["area"] || item["Area"] || "",
            industry: item["Ngành nghề"] || item["nganh_nghe"] || item["Industry"] || item.industry || ""
        };
    }

    // ⭐ CHUẨN HÓA MỌI PHẦN TỬ
    data = data.map(normalize);

    let html = `
    <div style="
    overflow-x: auto;
    overflow-y: auto;
    max-height: 500px;
">
    <table style="
        width:100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 14px;
        background: white;
        border-radius: 10px;
        overflow: hidden;
    ">
        <thead>
            <tr style="background:#000000ff; color:white;">
                <th style="padding:10px;">STT</th>
                <th style="padding:10px;">Tên</th>
                <th style="padding:10px;">Địa chỉ</th>
                <th style="padding:10px;">Diện tích</th>
                <th style="padding:10px;">Ngành nghề</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach((item, idx) => {
        html += `
        <tr style="background:${idx % 2 === 0 ? '#fafafa' : '#ffffff'};">
            <td style="padding:10px; border-top:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:10px; border-top:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:10px; border-top:1px solid #e5e7eb;">${item.address}</td>
            <td style="padding:10px; border-top:1px solid #e5e7eb;">${item.area}</td>
            <td style="padding:10px; border-top:1px solid #e5e7eb;">
                <ul style="margin:0; padding-left:18px; list-style-type:disc;">
                    ${
                        (item.industry || "")
                        .split(/[\n•;]/)
                        .map(i => i.trim())
                        .filter(i => i !== "")
                        .map(i => `<li>${i}</li>`)
                        .join("")
                    }
                </ul>
            </td>
        </tr>`;
    });

    html += `
        </tbody>
    </table>
    </div>
    `;

    return html;
}




// ============================================================
//  CHAT + VOICE + FILE + HAMBURGER + NEWS (FULL, KHÔNG LƯỢC)
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    
    
    
    
    
    
    
    // =========================
    // DOM elements CHAT
    // =========================
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatContainer = document.getElementById('chatContainer');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const fileButton = document.getElementById('fileButton');
    const voiceButton = document.getElementById('voiceButton');
    const fileInput = document.getElementById('fileInput');

    // =========================
    // ⭐ FIX QUAN TRỌNG: Auto scroll
    // =========================
    function scrollToBottom() {
        // Sử dụng requestAnimationFrame để đảm bảo DOM đã cập nhật
        requestAnimationFrame(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    }

    // trạng thái (duy trì tên biến cũ để tránh lỗi)
    let isRecording = false;
    let recordingTimer = null;
    let recordingTime = 0;

    // Speech-to-Text (Web Speech API)
    let recognition = null;

    function initSpeechRecognition() {
        if (recognition) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            recognition = null;
            return;
        }
        recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            try {
                const transcript = event.results[0][0].transcript;
                addUserMessage(`🎤 ${transcript}`);
                sendTextToChatbot(transcript);
            } catch (e) {
                console.error('STT parse error', e);
            }
        };

        recognition.onerror = () => {
            addBotMessage('⚠️ Không nghe rõ. Vui lòng thử lại.');
        };

        recognition.onend = () => {
            if (isRecording) {
                isRecording = false;
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceButton.style.color = '';
            }
        };
    }

    // ====================  GỬI TIN NHẮN VĂN BẢN  ====================
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        addUserMessage(message);
        messageInput.value = '';

        showTypingIndicator();

        fetch("https://luat-lao-dong.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: message })
        })
            .then(res => res.json())
            .then(data => {
                hideTypingIndicator();
                addBotMessage(data.answer || data.reply || "No response.");
            })
            .catch(() => {
                hideTypingIndicator();
                addBotMessage("⚠️ Lỗi kết nối đến chatbot Render.");
            });
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') sendMessage();
    });

    // ====================  HIỂN THỊ TIN NHẮN NGƯỜI DÙNG  ====================
    function addUserMessage(message, files = []) {
        if (welcomeMessage && welcomeMessage.style.display !== 'none') {
            welcomeMessage.style.display = 'none';
        }

        // ⭐ QUAN TRỌNG: Xóa class 'centered' để input chuyển xuống dưới
        messageInputContainer.classList.remove('centered');
        chatContainer.classList.add('has-messages');

        const userMessageElement = document.createElement('div');
        userMessageElement.className = 'message user-message';

        let messageContent = `<div class="message-bubble user-bubble">${escapeHtml(message)}</div>`;

        if (files && files.length > 0) {
            files.forEach(file => {
                messageContent += `
                <div class="file-message">
                    <i class="fas fa-file file-icon"></i>
                    <span class="file-name">${escapeHtml(file.name)}</span>
                </div>
            `;
            });
        }

        userMessageElement.innerHTML = messageContent;
        chatContainer.appendChild(userMessageElement);

        // ⭐ Auto scroll
        setTimeout(scrollToBottom, 50);
    }

    // ====================  HIỂN THỊ TIN NHẮN BOT  ====================
    function addBotMessage(message) {
        // ⭐ ĐẢM BẢO: Xóa class 'centered' khi bot trả lời
        messageInputContainer.classList.remove('centered');
        chatContainer.classList.add('has-messages');

        const botMessageElement = document.createElement('div');
        botMessageElement.className = 'message bot-message';
    let finalMessage = message;

try {
    let raw = message;

    // B1: loại bỏ ký tự xuống dòng không hợp lệ
    raw = raw.replace(/\n/g, "");
    raw = raw.trim();

    let parsed;

    // B2: parse thử lần 1
    try { parsed = JSON.parse(raw); } catch(e) {}

    // B3: nếu vẫn là string → parse lần 2
    if (parsed && typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch(e) {}
    }

    // B4: nếu vẫn là string → parse lần 3 (vì backend escape 3 lần)
    if (parsed && typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch(e) {}
    }

    // B5: check object dạng { data: [...] }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
        finalMessage = jsonToIndustrialTableV2(parsed.data);
    }

    // B6: trả về array trực tiếp
    else if (Array.isArray(parsed)) {
        finalMessage = jsonToIndustrialTableV2(parsed);
    }

} catch (err) {
    console.log("JSON PARSE ERR", err);
}




botMessageElement.innerHTML = `
    <div class="message-bubble bot-bubble">${finalMessage}</div>
`;

        chatContainer.appendChild(botMessageElement);

        // ⭐ Auto scroll
        setTimeout(scrollToBottom, 50);
    }

    // ====================  FORMAT MESSAGE (bold & newline)  ====================
    function formatMessage(text) {
        if (!text) return "";

        text = text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\n/g, "<br>");

        return text;
    }

    function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        
        
    }

    // ====================  TYPING INDICATOR  ====================
    function showTypingIndicator() {
        if (document.getElementById('typingIndicator')) return;

        const typingElement = document.createElement('div');
        typingElement.className = 'message bot-message';
        typingElement.id = 'typingIndicator';
        typingElement.innerHTML = `
            <div class="message-bubble bot-bubble">
                <span class="typing-dots">
                    <span></span><span></span><span></span>
                </span>
            </div>
        `;
        chatContainer.appendChild(typingElement);

        // ⭐ Auto scroll
        setTimeout(scrollToBottom, 50);
    }

    function hideTypingIndicator() {
        const typingElement = document.getElementById('typingIndicator');
        if (typingElement) {
            typingElement.remove();
            // ⭐ Auto scroll sau khi xóa typing indicator
            setTimeout(scrollToBottom, 50);
        }
    }

    // ====================  FILE UPLOAD  ====================
    fileButton.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function (e) {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const message = messageInput.value.trim() || "I'm sending you these files:";
            addUserMessage(message, files);
            messageInput.value = '';

            showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(`I received ${files.length} file(s). How can I help you with these?`);
            }, 1000);

            fileInput.value = '';
        }
    });

    // ====================  SPEECH-TO-TEXT  ====================
    function ensureSpeechSupport() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        return !!SpeechRecognition;
    }

    function startSpeechToText() {
        if (!ensureSpeechSupport()) {
            alert('Trình duyệt của bạn không hỗ trợ Speech-to-Text. Vui lòng dùng Chrome/Edge.');
            return;
        }

        initSpeechRecognition();

        try {
            recognition.start();
            isRecording = true;
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            voiceButton.style.color = '#dc2626';
        } catch (e) { }
    }

    function stopSpeechToText() {
        if (!recognition) return;
        try {
            recognition.stop();
        } catch (e) { }
        isRecording = false;
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.style.color = '';
    }

    voiceButton.addEventListener('click', function () {
        if (!isRecording) startSpeechToText();
        else stopSpeechToText();
    });

    function sendTextToChatbot(text) {
        if (!text.trim()) return;

        showTypingIndicator();

        fetch("https://luat-lao-dong.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        })
            .then(res => res.json())
            .then(data => {
                hideTypingIndicator();
                addBotMessage(data.answer || data.reply || "No response.");
            })
            .catch(() => {
                hideTypingIndicator();
                addBotMessage("⚠️ Lỗi kết nối chatbot.");
            });
    }

    window.stopRecording = function () {
        if (isRecording) stopSpeechToText();
    };

    window.cancelRecording = function () {
        if (isRecording) {
            try { recognition.abort(); } catch (e) { }
            isRecording = false;
            voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceButton.style.color = '';
        }

        const rec = document.getElementById('recordingBubble');
        if (rec) rec.remove();
    };

    if (ensureSpeechSupport()) {
        initSpeechRecognition();
    }

    // ====================  HANDLE MOBILE RESIZE  ====================
    function handleMobileResize() {
        if (window.innerWidth <= 768) {
            messageInput.addEventListener('focus', function () {
                setTimeout(scrollToBottom, 300);
            });

            messageInput.addEventListener('blur', function () {
                setTimeout(scrollToBottom, 300);
            });
        }
    }

    handleMobileResize();
    window.addEventListener('resize', handleMobileResize);


    // ============================================================
//                 HAMBURGER + NEW CHAT (IPHONE SAFE)
// ============================================================
const sidebar = document.getElementById("sidebar");
const hamburgerBtn = document.getElementById("hamburgerBtn");
const newChatBtn = document.getElementById("newChatBtn");

if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener("click", () => {
        // Mở / đóng sidebar
        sidebar.classList.toggle("open");
        // Di chuyển nút hamburger bằng class (an toàn cho iPhone)
        hamburgerBtn.classList.toggle("is-open");
    });
}


    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            // Xóa toàn bộ tin nhắn
            const messages = chatContainer.querySelectorAll('.message');
            messages.forEach(m => m.remove());

            // Hiện lại welcome
            if (welcomeMessage) {
                welcomeMessage.style.display = 'block';
                if (!chatContainer.contains(welcomeMessage)) {
                    chatContainer.insertBefore(welcomeMessage, chatContainer.firstChild);
                }
            }

            // Đưa input về trạng thái centered
            messageInputContainer.classList.add('centered');
            chatContainer.classList.remove('has-messages');

            // Xóa text đang nhập
            messageInput.value = "";

            // Đóng sidebar
            if (sidebar) sidebar.classList.remove("open");
            hamburgerBtn.classList.remove("is-open");
        });
    }

    // ============================================================
    //                 NEWS SYSTEM + PHÂN TRANG
    // ============================================================

    const newsBtn = document.getElementById("newsBtn");
    const newsBox = document.getElementById("newsBox");
    const newsList = document.getElementById("newsList");
    const newsPagination = document.getElementById("newsPagination");

    const newsReader = document.getElementById("newsReader");
    const newsBackBtn = document.getElementById("newsBackBtn");
    const newsReaderImage = document.getElementById("newsReaderImage");
    const newsReaderTitle = document.getElementById("newsReaderTitle");
    const newsReaderSubtitle = document.getElementById("newsReaderSubtitle");
    const newsReaderContent = document.getElementById("newsReaderContent");

    // ----- DATA TIN TỨC (DEMO – bạn có thể sửa / thêm bao nhiêu tin cũng được) -----
    
 /*   const newsData = [
    {
        id: 1,
        title: "IIP ra mắt AI mới",
        subtitle: "Nền tảng AI tăng tốc gấp 4 lần",
        img: "https://chatiip.com/images/ai.jpg",
        content: `
            <h3><strong>IIP AI</strong></h3>
            <p>Công nghệ AI mới của IIP chính thức ra mắt.</p>
            <img src="https://chatiip.com/images/demo.jpg">
        `
    },

    {
        id: 2,
        title: "Cập nhật luật lao động 2024",
        subtitle: "Những điểm mới bạn cần biết",
        img: "https://chatiip.com/images/law.jpg",
        content: `
            <p><strong>Luật Lao động 2024</strong></p>
            <p>Nhiều thay đổi quan trọng có hiệu lực.</p>
        `
    }
]; */


// ⭐⭐⭐ LOAD NEWS FROM BACKEND ⭐⭐⭐
const API_BASE = "https://vietbaichatiip.onrender.com";   // 📌 Nếu deploy thì đổi link này

let newsData = [];   // dữ liệu tin thật từ server

async function loadNewsFromServer() {
    try {
        const res = await fetch(`${API_BASE}/api/news`);
        newsData = await res.json();
        renderNewsPage(1);  // sau khi load xong → show page 1
    } catch (err) {
        console.error("Không tải được tin tức từ server:", err);
    }
}

// GỌI API NGAY KHI MỞ WEB
loadNewsFromServer();



    // ----- PHÂN TRANG -----
    let currentPage = 1;
    const itemsPerPage = 5;

    function renderNewsPage(page) {
        currentPage = page;
        newsList.innerHTML = "";

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = newsData.slice(start, end);

        pageData.forEach((news, index) => {
            const item = document.createElement("div");
            item.className = "news-item";

            item.innerHTML = `
                <img src="${news.img}" class="news-thumb">
                <div class="news-text">
                    <div class="news-title">${news.title}</div>
                    <div class="news-subtitle">${news.subtitle}</div>
                </div>
            `;

            item.onclick = () => openNews(start + index);
            newsList.appendChild(item);
        });

        renderPagination();
    }

    function renderPagination() {
        newsPagination.innerHTML = "";
        const totalPages = Math.ceil(newsData.length / itemsPerPage);

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("div");
            btn.className = "page-btn";
            if (i === currentPage) btn.classList.add("active");
            btn.textContent = i;

            btn.onclick = () => renderNewsPage(i);
            newsPagination.appendChild(btn);
        }
    }

    function openNews(index) {
        const news = newsData[index];
        if (!news) return;

        newsReaderImage.src = news.img;
        newsReaderTitle.textContent = news.title;
        newsReaderSubtitle.textContent = news.subtitle;
        newsReaderContent.innerHTML = news.content;

        document.body.classList.add("news-mode");

        // ====================== SEO DYNAMIC ======================
const slug = news.slug;
const articleUrl = `https://chatiip.com/news/${slug}`;

document.title = `${news.title} - ChatIIP`;

// description (160 ký tự)
const plainText = news.subtitle || news.content.replace(/<[^>]*>?/gm, "");
const shortDesc = plainText.length > 160 ? plainText.slice(0,157) + "..." : plainText;

// meta description
document.getElementById("metaDescription").setAttribute("content", shortDesc);

// OG tags
document.getElementById("ogTitle").setAttribute("content", news.title);
document.getElementById("ogDescription").setAttribute("content", shortDesc);
document.getElementById("ogImage").setAttribute("content", news.img);
document.getElementById("ogUrl").setAttribute("content", articleUrl);
document.head.innerHTML += `
    <meta property="article:published_time" content="${news.publishedAt}">
    <meta property="article:modified_time" content="${news.modifiedAt}">
`;

// Twitter
document.getElementById("twitterTitle").setAttribute("content", news.title);
document.getElementById("twitterDescription").setAttribute("content", shortDesc);
document.getElementById("twitterImage").setAttribute("content", news.img);

// JSON-LD (Google News)
const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": news.title,
    "description": shortDesc,
    "image": [news.img],
    "author": {
        "@type": "Organization",
        "name": "ChatIIP"
    },
    "publisher": {
        "@type": "Organization",
        "name": "ChatIIP",
        "logo": {
            "@type": "ImageObject",
            "url": "https://chatiip.com/logo.png"
        }
    },
    "datePublished": news.publishedAt,
    "dateModified": news.modifiedAt,
    "mainEntityOfPage": articleUrl
};

document.getElementById("seoJsonLd").textContent = JSON.stringify(jsonLd, null, 2);

// URL đẹp
window.history.pushState({}, news.title, `/news/${slug}`);


        newsReader.classList.add("open");
    }

    if (newsBackBtn) {
        newsBackBtn.addEventListener("click", () => {
            newsReader.classList.remove("open");
            // RESET SEO
// Reset OG nâng cao
document.querySelectorAll('meta[property="article:published_time"], meta[property="article:modified_time"]').forEach(tag => tag.remove());
      
document.title = "ChatIIP - Trợ lý AI & Tin tức";

document.getElementById("metaDescription").setAttribute("content",
    "ChatIIP - Trợ lý AI, tin tức và tư vấn pháp luật.");

document.getElementById("ogTitle").setAttribute("content", "ChatIIP");
document.getElementById("ogDescription").setAttribute("content",
    "ChatIIP - Trợ lý AI, tin tức và tư vấn pháp luật.");
document.getElementById("ogImage").setAttribute("content",
    "https://chatiip.com/default-og.jpg");
document.getElementById("ogUrl").setAttribute("content", "https://chatiip.com");

document.getElementById("twitterTitle").setAttribute("content", "ChatIIP");
document.getElementById("twitterDescription").setAttribute("content",
    "ChatIIP - Trợ lý AI, tin tức và tư vấn pháp luật.");
document.getElementById("twitterImage").setAttribute("content",
    "https://chatiip.com/default-og.jpg");

// reset JSON-LD
document.getElementById("seoJsonLd").textContent = "";

        });
    }

    if (newsBtn && newsBox) {
        newsBtn.addEventListener("click", () => {
            newsBox.classList.toggle("open");
        });
    }

    // Khởi tạo trang đầu tiên
    if (newsData.length > 0) {
        renderNewsPage(1);
    }
});



