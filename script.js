document.addEventListener('DOMContentLoaded', function() {
    // DOM elements (giữ giống HTML gốc)
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
    messageInput.addEventListener('keypress', function(e) {
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
    botMessageElement.innerHTML = `
        <div class="message-bubble bot-bubble">${formatMessage(message)}</div>
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
    fileButton.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
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
        } catch (e) {}
    }

    function stopSpeechToText() {
        if (!recognition) return;
        try {
            recognition.stop();
        } catch (e) {}
        isRecording = false;
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.style.color = '';
    }

    voiceButton.addEventListener('click', function() {
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

    window.stopRecording = function() {
        if (isRecording) stopSpeechToText();
    };

    window.cancelRecording = function() {
        if (isRecording) {
            try { recognition.abort(); } catch (e) {}
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
});
