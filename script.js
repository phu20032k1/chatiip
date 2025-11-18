
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

    // trạng thái (duy trì tên biến cũ để tránh lỗi)
    let isRecording = false;      // được dùng cho STT toggle
    let recordingTimer = null;    // giữ để tránh tham chiếu lỗi - không dùng cho STT
    let recordingTime = 0;        // giữ để tránh tham chiếu lỗi - không dùng cho STT

    // Speech-to-Text (Web Speech API)
    let recognition = null;

    function initSpeechRecognition() {
        if (recognition) return; // đã init
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            recognition = null;
            return;
        }
        recognition = new SpeechRecognition();
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            // nothing extra - UI giữ nguyên (micro icon đổi)
        };

        recognition.onresult = (event) => {
            try {
                const transcript = event.results[0][0].transcript;
                // Hiển thị nội dung người dùng và gửi lên chatbot
                addUserMessage(`🎤 ${transcript}`);
                sendTextToChatbot(transcript);
            } catch (e) {
                console.error('STT parse error', e);
            }
        };

        recognition.onerror = (ev) => {
            console.warn('Speech recognition error', ev);
            addBotMessage('⚠️ Không nghe rõ. Vui lòng thử lại.');
        };

        recognition.onend = () => {
            // Khi kết thúc tự động (người dùng dừng nói) — reset trạng thái
            if (isRecording) {
                // keep isRecording false? we'll ensure stopRecording sets it
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
            // backend trả answer
            addBotMessage(data.answer || data.reply || "No response.");
        })
        .catch(err => {
            console.error('Chat API error', err);
            hideTypingIndicator();
            addBotMessage("⚠️ Lỗi kết nối đến chatbot Render.");
        });
    }

    // sự kiện gửi
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });

    // ====================  HIỂN THỊ TIN NHẮN NGƯỜI DÙNG  ====================
    function addUserMessage(message, files = []) {
        if (welcomeMessage && welcomeMessage.style.display !== 'none') {
            welcomeMessage.style.display = 'none';
        }
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
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // ====================  HIỂN THỊ TIN NHẮN BOT  ====================
    function addBotMessage(message) {
        const botMessageElement = document.createElement('div');
        botMessageElement.className = 'message bot-message';
        botMessageElement.innerHTML = `
            <div class="message-bubble bot-bubble">${formatMessage(message)}</div>
        `;
        chatContainer.appendChild(botMessageElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // ====================  FORMAT MESSAGE (bold & newline)  ====================
    function formatMessage(text) {
    if (!text) return "";

    // 1) Escape HTML nhưng giữ lại dấu * và \n
    text = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2) In đậm: **text**
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // 3) Xuống dòng
    text = text.replace(/\n/g, "<br>");

    return text;
}
    // escape HTML entities for safety when inserting innerHTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ====================  TYPING INDICATOR  ====================
    function showTypingIndicator() {
        // tránh tạo nhiều indicator
        if (document.getElementById('typingIndicator')) return;
        const typingElement = document.createElement('div');
        typingElement.className = 'message bot-message';
        typingElement.id = 'typingIndicator';
        typingElement.innerHTML = `
            <div class="message-bubble bot-bubble">
                <span class="typing-dots"><span></span><span></span><span></span></span>
            </div>
        `;
        chatContainer.appendChild(typingElement);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function hideTypingIndicator() {
        const typingElement = document.getElementById('typingIndicator');
        if (typingElement) typingElement.remove();
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

            // gửi giả lập / hoặc bạn có API xử lý file
            showTypingIndicator();
            setTimeout(() => {
                hideTypingIndicator();
                addBotMessage(`I received ${files.length} file(s). How can I help you with these?`);
            }, 1000);

            fileInput.value = '';
        }
    });

    // ====================  SPEECH-TO-TEXT (KHÔNG UI GHI ÂM)  ====================
    // init khi cần
    function ensureSpeechSupport() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        return !!SpeechRecognition;
    }

    function startSpeechToText() {
        if (!ensureSpeechSupport()) {
            alert('Trình duyệt của bạn không hỗ trợ Speech-to-Text. Vui lòng dùng Chrome/Edge.');
            return;
        }

        initSpeechRecognition(); // tạo recognition nếu chưa có

        try {
            recognition.start();
            isRecording = true;
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            voiceButton.style.color = '#dc2626';
        } catch (e) {
            console.warn('recognition.start() error:', e);
            // nếu bắt lỗi (ví dụ start được gọi quá nhanh), reset recognition và thử lại lần sau
        }
    }

    function stopSpeechToText() {
        if (!recognition) return;
        try {
            recognition.stop();
        } catch (e) {
            console.warn('recognition.stop() error:', e);
        }
        isRecording = false;
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.style.color = '';
    }

    // gán hành vi cho nút micro (giữ nguyên icon, vị trí)
    voiceButton.addEventListener('click', function() {
        if (!isRecording) {
            // request permissions happens automatically when start() called
            startSpeechToText();
        } else {
            stopSpeechToText();
        }
    });

    // hàm gửi text đã chuyển đổi lên chatbot
    function sendTextToChatbot(text) {
        if (!text || !text.trim()) return;
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
        .catch(err => {
            console.error('sendTextToChatbot error', err);
            hideTypingIndicator();
            addBotMessage("⚠️ Lỗi kết nối chatbot.");
        });
    }

    // để tương thích nếu HTML gọi window.stopRecording/cancelRecording
    window.stopRecording = function() {
        // nếu đang STT thì stop, nếu không thì làm không có gì
        if (isRecording) stopSpeechToText();
    };
    window.cancelRecording = function() {
        if (isRecording) {
            try { recognition.abort(); } catch (e) {}
            isRecording = false;
            voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceButton.style.color = '';
        }
        // xóa bất kỳ UI ghi âm cũ nào (nếu còn)
        const rec = document.getElementById('recordingBubble');
        if (rec) rec.remove();
    };

    // khởi tạo recognition sẵn (không bắt buộc) để nhanh hơn khi bấm
    // nhưng không alert ngay để tránh popup
    if (ensureSpeechSupport()) {
        initSpeechRecognition();
    }
});


function selectFeature(featureName) {
    const messageInput = document.getElementById('messageInput');
    messageInput.value = `Tôi muốn biết về ${featureName}.`;
    messageInput.focus();
}
