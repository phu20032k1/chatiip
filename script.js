document.addEventListener('DOMContentLoaded', function () {

    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const chatContainer = document.getElementById('chatContainer');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const messageInputContainer = document.getElementById('messageInputContainer');
    const fileButton = document.getElementById('fileButton');
    const voiceButton = document.getElementById('voiceButton');
    const fileInput = document.getElementById('fileInput');

    /* =============================
       GỬI TIN NHẮN VĂN BẢN
    ============================== */
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
            addBotMessage(data.answer || "No response.");
        })
        .catch(() => {
            hideTypingIndicator();
            addBotMessage("⚠️ Lỗi kết nối đến chatbot Render.");
        });
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });


    /* =============================
       USER MESSAGE
    ============================== */
    function addUserMessage(message) {
        welcomeMessage.style.display = 'none';
        messageInputContainer.classList.remove('centered');
        chatContainer.classList.add('has-messages');

        const el = document.createElement('div');
        el.className = 'message user-message';
        el.innerHTML = `<div class="message-bubble user-bubble">${message}</div>`;

        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /* =============================
       BOT MESSAGE
    ============================== */
    function addBotMessage(message) {
        const el = document.createElement('div');
        el.className = 'message bot-message';
        el.innerHTML = `
            <div class="message-bubble bot-bubble">${formatMessage(message)}</div>
        `;
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /* =============================
       FORMAT MESSAGE
    ============================== */
    function formatMessage(t) {
        t = t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/\n/g, "<br>");
        return t;
    }

    /* =============================
       BOT TYPING
    ============================== */
    function showTypingIndicator() {
        const el = document.createElement('div');
        el.className = 'message bot-message';
        el.id = 'typingIndicator';
        el.innerHTML = `
            <div class="message-bubble bot-bubble">
                <span class="typing-dots"><span></span><span></span><span></span></span>
            </div>
        `;
        chatContainer.appendChild(el);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideTypingIndicator() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    /* =============================
        FILE UPLOAD (GIỮ NGUYÊN)
    ============================== */
    fileButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
        const files = [...e.target.files];
        if (files.length === 0) return;

        addUserMessage("📎 Bạn đã gửi file");

        showTypingIndicator();
        setTimeout(() => {
            hideTypingIndicator();
            addBotMessage(`Đã nhận ${files.length} file.`);
        }, 1000);

        fileInput.value = "";
    });


    /* =============================
       SPEECH TO TEXT — KHÔNG UI
    ============================== */
    let recognition;
    let isRecording = false;

    function initSTT() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            alert("Trình duyệt không hỗ trợ Speech-to-Text!");
            return;
        }

        recognition = new SR();
        recognition.lang = "vi-VN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            addUserMessage("🎤 " + text);
            sendMessageToChatbot(text);
        };

        recognition.onerror = () => {
            addBotMessage("⚠️ Không nghe rõ. Hãy thử lại.");
        };
    }

    async function startRecording() {
        if (!recognition) initSTT();

        isRecording = true;
        voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
        voiceButton.style.color = '#dc2626';

        recognition.start();
    }

    function stopRecording() {
        if (!isRecording) return;
        isRecording = false;

        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.style.color = '';

        recognition.stop();
    }

    voiceButton.addEventListener('click', () => {
        if (!isRecording) startRecording();
        else stopRecording();
    });

    /* =============================
       GỬI TEXT SAU KHI NHẬN GIỌNG
    ============================== */
    function sendMessageToChatbot(text) {
        showTypingIndicator();

        fetch("https://luat-lao-dong.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        })
        .then(res => res.json())
        .then(data => {
            hideTypingIndicator();
            addBotMessage(data.answer);
        })
        .catch(() => {
            hideTypingIndicator();
            addBotMessage("⚠️ Lỗi kết nối chatbot.");
        });
    }

});
