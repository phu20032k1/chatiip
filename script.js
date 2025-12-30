
// ====================  SESSION & USER ID & GOOGLE LOG  ====================
function getSessionId() {
    let sid = localStorage.getItem("chatiip_session_id");
    if (!sid) {
        // ✅ FIX: tránh lỗi ReferenceError nếu trình duyệt không có window.crypto
        sid = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + "_" + Math.random();
        localStorage.setItem("chatiip_session_id", sid);
    }
    return sid;
}

function getUserId() {
    return localStorage.getItem("chatiip_user_id") || "anonymous";
}

const GOOGLE_LOG_URL =
    "https://script.google.com/macros/s/AKfycbz1RqVbn7j_7dUxmuAFuzUmBgJnqsJVIAYJzFjnovJraQyVEb193XI5lbp5l-33DB5cuA/exec";

const GOOGLE_SECRET = "minhphu2003";

async function logToGoogle(payload) {
    try {
        await fetch(GOOGLE_LOG_URL, {
            method: "POST",
            body: JSON.stringify({
                token: GOOGLE_SECRET,
                ...payload,
                source: "chatiip_frontend",
                user_agent: navigator.userAgent
            })
        });
    } catch (e) {
        console.error("Google log error", e);
    }
}





// ====================  ESCAPE HTML (GLOBAL)  ====================
function escapeHtmlGlobal(unsafe) {
    return String(unsafe ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ⭐ jsonToIndustrialTableV2 giữ nguyên để render bảng từ JSON
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

    const total = data.length;

    let rows = "";
    let cards = "";

    data.forEach((item, idx) => {
        const industries = (item.industry || "")
            .split(/[\n•;]/)
            .map(i => i.trim())
            .filter(Boolean);

        const chips = industries.length
            ? industries.map(i => `<span class="chip">${escapeHtmlGlobal(i)}</span>`).join("")
            : `<span class="chip">—</span>`;

        rows += `
          <tr>
            <td class="col-stt">${idx + 1}</td>
            <td>${escapeHtmlGlobal(String(item.name || ""))}</td>
            <td>${escapeHtmlGlobal(String(item.address || ""))}</td>
            <td class="col-area">${escapeHtmlGlobal(String(item.area || ""))}</td>
            <td><div class="chip-row">${chips}</div></td>
          </tr>
        `;

        cards += `
          <article class="data-card">
            <div class="data-card-head">
              <div class="data-card-title">${idx + 1}. ${escapeHtmlGlobal(String(item.name || ""))}</div>
              <div class="data-card-badge">${escapeHtmlGlobal(String(item.area || "")) || "—"}</div>
            </div>

            <div class="data-card-line">
              <div class="data-card-label">Địa chỉ</div>
              <div class="data-card-value">${escapeHtmlGlobal(String(item.address || "")) || "—"}</div>
            </div>

            <div class="data-card-line">
              <div class="data-card-label">Ngành nghề</div>
              <div class="data-card-value"><div class="chip-row">${chips}</div></div>
            </div>
          </article>
        `;
    });

    const html = `
      <div class="data-block" data-view="table">
        <div class="data-block-toolbar">
          <div class="data-block-title">Kết quả: <strong>${total}</strong></div>
          <div class="data-view-tabs" role="tablist" aria-label="Chế độ xem">
            <button class="data-view-tab active" type="button" data-view-target="table" role="tab" aria-selected="true">
              <i class="fa-solid fa-table"></i> Bảng
            </button>
            <button class="data-view-tab" type="button" data-view-target="cards" role="tab" aria-selected="false">
              <i class="fa-regular fa-rectangle-list"></i> Thẻ
            </button>
          </div>
        </div>

        <div class="data-panel active" data-view-panel="table">
          <div class="data-table-wrap" role="region" aria-label="Bảng dữ liệu" tabindex="0">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-stt">STT</th>
                  <th>Tên</th>
                  <th>Địa chỉ</th>
                  <th class="col-area">Diện tích</th>
                  <th>Ngành nghề</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="data-panel" data-view-panel="cards">
          <div class="data-cards-wrap" role="region" aria-label="Thẻ dữ liệu" tabindex="0">
            <div class="data-cards">
              ${cards}
            </div>
          </div>
        </div>
      </div>
    `;

    return html;
}



let speechLang = "vi-VN"; // mặc định
// ⭐ HÀM LOAD UI THEO NGÔN NGỮ
async function loadLanguageUI(langCode) {
    try {
        const res = await fetch(`/lang/${langCode}.json`);
        const dict = await res.json();

        // Welcome text
        const w = document.getElementById("welcomeMessageText");
        if (w) w.innerText = dict.welcome;

        // Placeholder input
        const input = document.getElementById("messageInput");
        if (input) input.placeholder = dict.placeholder;

        // New chat button
        const newChat = document.getElementById("newChatBtn");
        if (newChat) newChat.innerHTML = `<i class="fas fa-plus"></i> ${dict.new_chat}`;

    } catch (err) {
        console.warn("Không thể tải file ngôn ngữ:", langCode, err);
    }
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
        // Kéo xuống cuối ở cả 2 trường hợp:
        // 1) chatContainer có scroll nội bộ
        // 2) trang (window) mới là phần đang scroll (một số layout)
        requestAnimationFrame(() => {
            try {
                if (chatContainer) {
                    const canInnerScroll = (chatContainer.scrollHeight - chatContainer.clientHeight) > 2;
                    if (canInnerScroll) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }
                }

                // Window scroll: đảm bảo luôn thấy tin nhắn mới + ô nhập
                const anchor = document.getElementById("messageInputContainer") || chatContainer || document.body;
                const targetY = anchor.getBoundingClientRect().bottom + window.scrollY + 16;
                window.scrollTo({ top: Math.min(targetY, document.documentElement.scrollHeight), behavior: "smooth" });
            } catch (e) {
                // fallback
                try {
                    window.scrollTo(0, document.documentElement.scrollHeight);
                } catch (_) { }
            }
        });
    }


    // ⭐ Auto expand textarea (tự mở rộng ô nhập tin nhắn)
    messageInput.addEventListener("input", function () {
        this.style.height = "auto";                // reset chiều cao -> giúp tính đúng
        this.style.height = this.scrollHeight + "px";  // cao bằng đúng nội dung

        // Nếu cao hơn 120px -> bật scroll để không vượt quá màn hình
        if (this.scrollHeight > 120) {
            this.style.overflowY = "scroll";
        } else {
            this.style.overflowY = "hidden";
        }
    });




    // trạng thái (duy trì tên biến cũ để tránh lỗi)
    let isRecording = false;
    let recordingTimer = null;
    let recordingTime = 0;

    // Google STT (MediaRecorder)
    let mediaRecorder = null;
    let mediaStream = null;
    let mediaChunks = [];


    // ====================  GỬI TIN NHẮN VĂN BẢN  ====================
    function sendMessage() {

        const message = messageInput.value.trim();
        if (!message) return;

        const messageId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + "_" + Math.random();

        // ✅ LƯU CÂU HỎI SAU KHI ĐÃ CÓ message
        logToGoogle({
            message_id: messageId,
            session_id: getSessionId(),
            user_id: getUserId(),
            question: message,
            status: "asked"
        });

        addUserMessage(message);
        messageInput.value = '';

        messageInput.style.height = "40px";
        messageInput.style.overflowY = "hidden";

        showTypingIndicator();

        fetch("https://luat-lao-dong.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: message })
        })
            .then(res => res.json())
            .then(data => {
                hideTypingIndicator();
                const answer = data.answer || data.reply || "No response.";
                addBotMessage(answer, { messageId, question: message });

                // ✅ UPDATE ANSWER VÀO GOOGLE
                logToGoogle({
                    message_id: messageId,
                    session_id: getSessionId(),
                    user_id: getUserId(),
                    question: message,
                    answer: answer,
                    status: "answered"
                });
            })
            .catch(() => {
                hideTypingIndicator();
                addBotMessage("⚠️ Lỗi kết nối đến chatbot Render.");
            });
    }


    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
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

        const userMsgId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + "_" + Math.random();

        userMessageElement.dataset.userMessageId = userMsgId;
        userMessageElement.dataset.text = message;

        let messageContent = `
          <div class="user-stack">
            <div class="message-bubble user-bubble">${escapeHtml(message)}</div>
            <div class="message-actions user-actions">
              ${renderActionButton('user-copy', 'fa-regular fa-copy', 'Sao chép')}
              ${renderActionButton('user-select', 'fa-solid fa-i-cursor', 'Chọn văn bản')}
              ${renderActionButton('user-edit', 'fa-regular fa-pen-to-square', 'Chỉnh sửa')}
              ${renderActionButton('user-share', 'fa-solid fa-share-nodes', 'Chia sẻ')}
            </div>
          </div>
        `;

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

    // ====================  HIỂN THỊ TIN NHẮN BOT + ACTIONS  ====================  ====================
    function renderActionButton(action, iconClass, tooltip) {
        return `
            <button class="action-btn" type="button" data-action="${action}" aria-label="${tooltip}">
                <i class="${iconClass}"></i>
                <span class="action-tooltip">${tooltip}</span>
            </button>
        `;
    }

    function normalizeBotMessage(rawMessage) {
        let finalMessage = rawMessage ?? "";

        try {
            let raw = String(rawMessage ?? "");

            // B1: loại bỏ ký tự xuống dòng không hợp lệ
            raw = raw.replace(/\n/g, "").trim();

            let parsed;

            // B2: parse thử lần 1
            try { parsed = JSON.parse(raw); } catch (e) { }

            // B3: nếu vẫn là string → parse lần 2
            if (parsed && typeof parsed === "string") {
                try { parsed = JSON.parse(parsed); } catch (e) { }
            }

            // B4: nếu vẫn là string → parse lần 3
            if (parsed && typeof parsed === "string") {
                try { parsed = JSON.parse(parsed); } catch (e) { }
            }

            // B5: check object dạng { data: [...] }
            if (parsed && typeof parsed === "object" && Array.isArray(parsed.data)) {
                finalMessage = jsonToIndustrialTableV2(parsed.data);
            }
            // B6: trả về array trực tiếp
            else if (Array.isArray(parsed)) {
                finalMessage = jsonToIndustrialTableV2(parsed);
            } else {
                finalMessage = rawMessage;
            }

        } catch (err) {
            console.log("JSON PARSE ERR", err);
            finalMessage = rawMessage;
        }

        const isHTML = String(finalMessage).trim().startsWith("<");
        const html = isHTML ? String(finalMessage) : formatMessage(String(finalMessage));

        return { finalMessage, html, isHTML };
    }

    function addBotMessage(message, meta = {}) {
        const { messageId = "", question = "" } = meta || {};

        // ⭐ ĐẢM BẢO: Xóa class 'centered' khi bot trả lời
        messageInputContainer.classList.remove('centered');
        chatContainer.classList.add('has-messages');

        const botMessageElement = document.createElement('div');
        botMessageElement.className = 'message bot-message';

        if (messageId) botMessageElement.dataset.messageId = messageId;
        if (question) botMessageElement.dataset.question = question;

        const normalized = normalizeBotMessage(message);

        botMessageElement.innerHTML = `
            <div class="bot-stack">
                <div class="message-bubble bot-bubble">${normalized.html}</div>
                <div class="message-actions">
                    ${renderActionButton('like', 'fa-regular fa-thumbs-up', 'Đồng ý')}
                    ${renderActionButton('dislike', 'fa-regular fa-thumbs-down', 'Không đồng ý')}
                    ${renderActionButton('refresh', 'fa-solid fa-arrows-rotate', 'Trả lời lại')}
                    ${renderActionButton('copy', 'fa-regular fa-copy', 'Sao chép')}
                </div>
            </div>
        `;

        chatContainer.appendChild(botMessageElement);

        // ⭐ Auto scroll
        setTimeout(scrollToBottom, 50);
    }

    // ====================  LINKIFY (tô xanh & click được)  ====================
    function linkifyHtml(html) {
        const urlRegex = /((https?:\/\/|www\.)[^\s<]+[^<.,;:"')\]\s])/g;

        return String(html)
            .split(/(<[^>]+>)/g) // giữ nguyên thẻ html (strong, br, ...)
            .map(part => {
                if (part.startsWith('<')) return part;
                return part.replace(urlRegex, (raw) => {
                    const href = raw.startsWith('http') ? raw : `https://${raw}`;
                    return `<a class="chat-link" href="${href}" target="_blank" rel="noopener noreferrer">${raw}</a>`;
                });
            })
            .join('');
    }

    // ====================  FORMAT MESSAGE (bold & newline)  ====================
    function formatMessage(text) {
        if (!text) return "";

        text = text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\n/g, "<br>");

        text = linkifyHtml(text);

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



    // ====================  ACTION BUTTONS (LIKE / DISLIKE / REFRESH / COPY)  ====================
    const feedbackOverlay = document.getElementById('feedbackOverlay');
    const feedbackCloseBtn = document.getElementById('feedbackCloseBtn');
    const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
    const feedbackChips = document.getElementById('feedbackChips');
    const feedbackDetail = document.getElementById('feedbackDetail');

    let activeFeedbackContext = null; // { messageId, question, answerText }
    let selectedFeedbackReason = "";

    function openFeedbackModal(ctx) {
        if (!feedbackOverlay) return;

        activeFeedbackContext = ctx;
        selectedFeedbackReason = "";

        // reset UI
        feedbackOverlay.classList.add('open');
        feedbackOverlay.setAttribute('aria-hidden', 'false');

        feedbackChips?.querySelectorAll('.chip')?.forEach(c => c.classList.remove('active'));
        if (feedbackDetail) feedbackDetail.value = "";
    }

    function closeFeedbackModal() {
        if (!feedbackOverlay) return;
        feedbackOverlay.classList.remove('open');
        feedbackOverlay.setAttribute('aria-hidden', 'true');
        activeFeedbackContext = null;
        selectedFeedbackReason = "";
    }

    feedbackCloseBtn?.addEventListener('click', closeFeedbackModal);
    feedbackOverlay?.addEventListener('click', (e) => {
        // click outside modal
        if (e.target === feedbackOverlay) closeFeedbackModal();
    });

    feedbackChips?.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        feedbackChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedFeedbackReason = chip.dataset.reason || chip.innerText.trim();
    });

    feedbackSubmitBtn?.addEventListener('click', () => {
        if (!activeFeedbackContext) return;

        if (!selectedFeedbackReason) {
            alert("Vui lòng chọn lý do");
            return;
        }

        const detail = (feedbackDetail?.value || "").trim();

        logToGoogle({
            event: 'reaction',              // ✅ ĐỔI DÒNG NÀY
            reaction: 'dislike',             // ✅ BẮT BUỘC
            message_id: activeFeedbackContext.messageId || "",
            session_id: getSessionId(),
            user_id: getUserId(),
            question: activeFeedbackContext.question || "",
            answer: activeFeedbackContext.answerText || "",

            feedback_reason: selectedFeedbackReason, // ✅ CỘT reason
            feedback_detail: detail                  // ✅ CỘT detail
        });

        closeFeedbackModal();
    });


    function setReactionUI(botEl, reaction) {
        const likeBtn = botEl.querySelector('.action-btn[data-action="like"]');
        const dislikeBtn = botEl.querySelector('.action-btn[data-action="dislike"]');
        if (likeBtn) likeBtn.classList.toggle('active', reaction === 'like');
        if (dislikeBtn) dislikeBtn.classList.toggle('active', reaction === 'dislike');
        botEl.dataset.reaction = reaction;
    }

    function showTempTooltip(btn, text, duration = 1200) {
        const tip = btn.querySelector('.action-tooltip');
        if (!tip) return;
        const old = tip.textContent;
        tip.textContent = text;
        btn.classList.add('show-tooltip');
        window.clearTimeout(btn._tooltipTimer);
        btn._tooltipTimer = window.setTimeout(() => {
            tip.textContent = old;
            btn.classList.remove('show-tooltip');
        }, duration);
    }

    async function regenerateAnswerFor(botEl) {
        const question = botEl.dataset.question || "";
        const messageId = botEl.dataset.messageId || "";
        if (!question) return;

        const bubble = botEl.querySelector('.message-bubble');
        if (!bubble) return;

        bubble.innerHTML = `
            <span class="typing-dots">
                <span></span><span></span><span></span>
            </span>
        `;

        logToGoogle({
            event: 'regenerate',
            message_id: messageId,
            session_id: getSessionId(),
            user_id: getUserId(),
            question,
            status: 'requested'
        });

        try {
            const res = await fetch('https://luat-lao-dong.onrender.com/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const data = await res.json();
            const answer = data.answer || data.reply || 'No response.';

            const normalized = normalizeBotMessage(answer);
            bubble.innerHTML = normalized.html;

            logToGoogle({
                event: 'regenerate',
                message_id: messageId,
                session_id: getSessionId(),
                user_id: getUserId(),
                question,
                answer,
                status: 'done'
            });
        } catch (e) {
            bubble.innerHTML = '⚠️ Lỗi kết nối đến chatbot Render.';
            logToGoogle({
                event: 'regenerate',
                message_id: messageId,
                session_id: getSessionId(),
                user_id: getUserId(),
                question,
                status: 'failed'
            });
        }
    }

    // ====================  USER MESSAGE ACTIONS (COPY/SELECT/EDIT/SHARE)  ====================
    function selectTextInElement(el) {
        if (!el) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function clearMessagesAfter(messageEl) {
        if (!messageEl) return;
        let next = messageEl.nextSibling;
        while (next) {
            const toRemove = next;
            next = next.nextSibling;
            toRemove.remove();
        }
        setTimeout(scrollToBottom, 50);
    }

    function openEditPanel(userEl) {
        if (!userEl || userEl.classList.contains('editing')) return;

        const bubble = userEl.querySelector('.message-bubble');
        const actions = userEl.querySelector('.message-actions');
        const stack = userEl.querySelector('.user-stack') || userEl;
        const currentText = (userEl.dataset.text || bubble?.innerText || '').trim();

        userEl.classList.add('editing');

        // remove old panel if any
        stack.querySelector('.edit-panel')?.remove();

        const panel = document.createElement('div');
        panel.className = 'edit-panel';
        panel.innerHTML = `
          <textarea class="edit-textarea" rows="3"></textarea>
          <div class="edit-actions">
            <button type="button" class="edit-btn" data-edit-action="cancel">Hủy</button>
            <button type="button" class="edit-btn primary" data-edit-action="save">Lưu & gửi</button>
          </div>
        `;

        stack.appendChild(panel);
        const textarea = panel.querySelector('.edit-textarea');
        if (textarea) {
            textarea.value = currentText;
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }

        // hide bubble/actions by CSS (.editing)
        setTimeout(scrollToBottom, 50);
    }

    async function postChat(question) {
        const res = await fetch('https://luat-lao-dong.onrender.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();
        return data.answer || data.reply || 'No response.';
    }

    async function submitEditedMessage(userEl, newText) {
        const bubble = userEl.querySelector('.message-bubble');
        if (bubble) bubble.innerHTML = escapeHtml(newText);
        userEl.dataset.text = newText;

        // close edit mode
        userEl.classList.remove('editing');
        userEl.querySelector('.edit-panel')?.remove();

        // remove all messages after this user message (giống ChatGPT)
        clearMessagesAfter(userEl);

        const messageId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + "_" + Math.random();

        // asked log
        logToGoogle({
            event: 'edit',
            message_id: messageId,
            session_id: getSessionId(),
            user_id: getUserId(),
            question: newText,
            status: 'asked'
        });

        showTypingIndicator();

        try {
            const answer = await postChat(newText);
            hideTypingIndicator();
            addBotMessage(answer, { messageId, question: newText });

            logToGoogle({
                event: 'edit',
                message_id: messageId,
                session_id: getSessionId(),
                user_id: getUserId(),
                question: newText,
                answer: answer,
                status: 'answered'
            });
        } catch (e) {
            hideTypingIndicator();
            addBotMessage('⚠️ Lỗi kết nối đến chatbot Render.');
        }
    }

    chatContainer.addEventListener('click', async (e) => {
        // Edit panel actions
        const editActionBtn = e.target.closest('[data-edit-action]');
        if (editActionBtn) {
            const action = editActionBtn.dataset.editAction;
            const userEl = editActionBtn.closest('.user-message');
            if (!userEl) return;

            if (action === 'cancel') {
                userEl.classList.remove('editing');
                userEl.querySelector('.edit-panel')?.remove();
                return;
            }

            if (action === 'save') {
                const textarea = userEl.querySelector('.edit-textarea');
                const newText = (textarea?.value || '').trim();
                if (!newText) {
                    alert('Tin nhắn không được để trống');
                    return;
                }
                await submitEditedMessage(userEl, newText);
                return;
            }
        }

        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        const messageEl = btn.closest('.message');
        if (!messageEl) return;

        // USER MESSAGE ACTIONS
        if (messageEl.classList.contains('user-message')) {
            const bubble = messageEl.querySelector('.message-bubble');
            const text = (messageEl.dataset.text || bubble?.innerText || '').trim();
            const action = btn.dataset.action;

            if (action === 'user-copy') {
                try {
                    await navigator.clipboard.writeText(text);
                    showTempTooltip(btn, 'Đã sao chép');
                } catch (err) {
                    showTempTooltip(btn, 'Không thể sao chép');
                }
                return;
            }

            if (action === 'user-select') {
                if (bubble) selectTextInElement(bubble);
                showTempTooltip(btn, 'Đã chọn');
                return;
            }

            if (action === 'user-share') {
                try {
                    if (navigator.share) {
                        await navigator.share({ text });
                        showTempTooltip(btn, 'Đã chia sẻ');
                    } else {
                        await navigator.clipboard.writeText(text);
                        showTempTooltip(btn, 'Đã sao chép');
                    }
                } catch (err) {
                    showTempTooltip(btn, 'Không thể chia sẻ');
                }
                return;
            }

            if (action === 'user-edit') {
                openEditPanel(messageEl);
                return;
            }

            return;
        }

        // BOT MESSAGE ACTIONS
        const botEl = messageEl.classList.contains('bot-message') ? messageEl : btn.closest('.bot-message');
        if (!botEl) return;

        const action = btn.dataset.action;
        const messageId = botEl.dataset.messageId || "";
        const question = botEl.dataset.question || "";
        const bubble = botEl.querySelector('.message-bubble');
        const answerText = bubble ? bubble.innerText.trim() : "";

        if (action === 'copy') {
            try {
                await navigator.clipboard.writeText(answerText);
                showTempTooltip(btn, 'Đã sao chép');

                logToGoogle({
                    event: 'copy',
                    message_id: messageId,
                    session_id: getSessionId(),
                    user_id: getUserId(),
                    question,
                    status: 'done'
                });
            } catch (err) {
                showTempTooltip(btn, 'Không thể sao chép');
            }
            return;
        }

        if (action === 'refresh') {
            await regenerateAnswerFor(botEl);
            return;
        }

        if (action === 'like' || action === 'dislike') {
            const current = botEl.dataset.reaction || "";
            if (current === action) return; // tránh double-click tăng lượt

            setReactionUI(botEl, action);

            logToGoogle({
                event: 'reaction',
                reaction: action,
                message_id: messageId,
                session_id: getSessionId(),
                user_id: getUserId(),
                question,
                answer: answerText,
                status: 'clicked'
            });

            if (action === 'dislike') {
                openFeedbackModal({ messageId, question, answerText });
            }
            return;
        }
    });

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



    async function sendAudioToGoogleSTT(blob) {
        try {
            const fd = new FormData();
            fd.append("audio", blob, "speech.webm");
            fd.append("lang", speechLang);

            const res = await fetch("https://chatiip-stt.fly.dev/stt", {
                method: "POST",
                body: fd
            });

            const data = await res.json();
            return data.text || "";
        } catch (e) {
            console.error("STT network error:", e);
            return "";
        }
    }


    function showRecordingBubble() {
        const messagesContainer =
            document.querySelector(".chat-messages") ||
            document.querySelector(".messages") ||
            document.getElementById("chatMessages");

        if (!messagesContainer) return;

        if (document.getElementById("recordingBubble")) return;

        const bubble = document.createElement("div");
        bubble.id = "recordingBubble";
        bubble.className = "message bot recording";
        bubble.innerHTML = "🎧 Đang nghe...";

        messagesContainer.appendChild(bubble);
        bubble.scrollIntoView({ behavior: "smooth" });
    }


    function removeRecordingBubble() {
        const bubble = document.getElementById("recordingBubble");
        if (bubble) bubble.remove();
    }


    async function startSpeechToText() {

        if (isRecording) return;
        showRecordingBubble();
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            let mimeType = "audio/webm";

            mediaChunks = [];
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType });

            mediaRecorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) mediaChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {

                removeRecordingBubble();

                const blob = new Blob(mediaChunks, { type: mimeType });

                isRecording = false;
                voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceButton.style.color = "";

                const text = await sendAudioToGoogleSTT(blob);

                if (text) {
                    addUserMessage(`🎤 ${text}`);
                    sendTextToChatbot(text);
                } else {
                    addBotMessage("⚠️ Không nghe rõ, vui lòng thử lại.");
                }

                mediaStream.getTracks().forEach(t => t.stop());
                mediaRecorder = null;
                mediaChunks = [];

                if (recordingTimer) {
                    clearTimeout(recordingTimer);
                    recordingTimer = null;
                }

            };

            mediaRecorder.start();

            recordingTimer = setTimeout(() => {
                if (isRecording) stopSpeechToText();
            }, 5000); // tự dừng sau 5 giây

            isRecording = true;
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            voiceButton.style.color = "#dc2626";

        } catch (err) {
            console.error(err);
            addBotMessage("⚠️ Không truy cập được microphone.");
        }
    }


    function stopSpeechToText() {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
    }




    voiceButton.addEventListener('click', function () {
        if (!isRecording) startSpeechToText();
        else stopSpeechToText();
    });

    function sendTextToChatbot(text) {
        if (!text.trim()) return;

        showTypingIndicator();

        const messageId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now() + "_" + Math.random();

        // log asked
        logToGoogle({
            message_id: messageId,
            session_id: getSessionId(),
            user_id: getUserId(),
            question: text,
            status: "asked"
        });

        fetch("https://luat-lao-dong.onrender.com/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        })
            .then(res => res.json())
            .then(data => {
                hideTypingIndicator();
                const answer = data.answer || data.reply || "No response.";
                addBotMessage(answer, { messageId, question: text });

                // ✅ log answered (điểm bạn đang thiếu)
                logToGoogle({
                    message_id: messageId,
                    session_id: getSessionId(),
                    user_id: getUserId(),
                    question: text,
                    answer: answer,
                    status: "answered"
                });
            })
            .catch(() => {
                hideTypingIndicator();
                addBotMessage("⚠️ Lỗi kết nối chatbot.");

                // (tuỳ chọn) log fail
                logToGoogle({
                    message_id: messageId,
                    session_id: getSessionId(),
                    user_id: getUserId(),
                    question: text,
                    status: "failed"
                });
            });
    }


    window.stopRecording = function () {
        if (isRecording) stopSpeechToText();
    };


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

            // ✅ THÊM 2 DÒNG NÀY VÀO:
            // Đóng sidebar
            if (sidebar) sidebar.classList.remove("open");
            hamburgerBtn.classList.remove("is-open");
            // ✅ XONG
        });
    }

    // ⭐ Nút Tin tức: chuyển sang trang tin fullpage
    const newsBtn = document.getElementById("newsBtn");
    if (newsBtn) {
        newsBtn.addEventListener("click", () => {
            window.location.href = "news.html";
        });
    }




    // ⭐ Toggle chế độ xem (Bảng/Thẻ) cho các khối dữ liệu
    document.addEventListener("click", (e) => {
        const tab = e.target.closest(".data-view-tab");
        if (!tab) return;

        const block = tab.closest(".data-block");
        if (!block) return;

        const target = tab.getAttribute("data-view-target");
        if (!target) return;

        // Tabs
        block.querySelectorAll(".data-view-tab").forEach((b) => {
            const isActive = b === tab;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-selected", isActive ? "true" : "false");
        });

        // Panels
        block.querySelectorAll(".data-panel").forEach((panel) => {
            panel.classList.toggle("active", panel.getAttribute("data-view-panel") === target);
        });

        // Kéo xuống cho chắc (đặc biệt khi chuyển sang thẻ)
        scrollToBottom();
    });

    // ⭐ Auto scroll mạnh hơn: khi DOM thay đổi (bảng / ảnh / typing), luôn kéo xuống cuối
    try {
        const chatObserver = new MutationObserver(() => {
            // nếu user đang scroll lên đọc thì vẫn ưu tiên kéo xuống theo yêu cầu
            scrollToBottom();
        });
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
    } catch (e) {
        // ignore
    }

});
