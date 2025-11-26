// ==============================
//  NEWS.JS – V2 (INFINITE SCROLL)
// ==============================

let allNews = [];
let currentList = [];     // danh sách hiện đang hiển thị (sau khi search/filter)
let workingList = [];     // danh sách dùng để phân trang (bỏ bài featured)
let page = 1;
const perPage = 10;       // số bài mỗi lần load thêm
let loadingMore = false;
let noMore = false;

// API backend
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api/news"
    : "https://admin.chatiip.com/api/news";

const featuredEl = document.getElementById("featuredNews");
const listEl = document.getElementById("newsList");
const jsonLdEl = document.getElementById("newsJsonLd");

// input filter
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

/* ==========================
   Skeleton loading
   ========================== */
function showSkeleton() {
  featuredEl.innerHTML = `
    <div class="skeleton-wrap">
      <div class="skeleton-box"></div>
      <div>
        <div class="skeleton-line" style="width:80%; height:24px;"></div>
        <div class="skeleton-line" style="width:60%;"></div>
        <div class="skeleton-line" style="width:90%;"></div>
        <div class="skeleton-line" style="width:50%;"></div>
      </div>
    </div>
  `;

  listEl.innerHTML = `
    <div class="news-item skeleton-box"></div>
    <div class="news-item skeleton-box"></div>
    <div class="news-item skeleton-box"></div>
  `;
}

/* ==========================
   Cắt ngắn text
   ========================== */
function shortText(text, max = 120) {
  if (!text) return "";
  const clean = String(text);
  return clean.length > max ? clean.slice(0, max) + "..." : clean;
}

/* ==========================
   Render bài nổi bật
   ========================== */
function renderFeaturedItem(n) {
  const img = n.img && n.img.trim() !== "" ? n.img : "https://chatiip.com/default-og.jpg";
  const date = n.publishedAt
    ? new Date(n.publishedAt).toLocaleDateString("vi-VN")
    : "Không rõ ngày";

  featuredEl.innerHTML = `
    <div class="featured-image-wrap">
      <img src="${img}" alt="${n.title}" class="featured-image">
    </div>
    <div class="featured-meta">
      <h2 class="featured-title" id="featuredTitle">${n.title}</h2>
      <div class="featured-subtitle">
        ${shortText(n.subtitle || "", 180)}
      </div>
      <div class="featured-info">
        <i class="far fa-clock"></i>
        <span>${date}</span>
      </div>
    </div>
  `;

  const go = () => {
    window.location.href = `article.html?slug=${n.slug}`;
  };
  featuredEl.querySelector(".featured-image-wrap").onclick = go;
  featuredEl.querySelector("#featuredTitle").onclick = go;
}

/* ==========================
   Render 1 card tin
   ========================== */
function renderNewsItem(n) {
  const div = document.createElement("div");
  div.className = "news-item fade-in";

  const img = n.img && n.img.trim() !== ""
    ? n.img
    : "https://chatiip.com/default-og.jpg";

  const date = n.publishedAt
    ? new Date(n.publishedAt).toLocaleDateString("vi-VN")
    : "Không rõ ngày";

  div.innerHTML = `
    <img src="${img}" class="news-thumb" loading="lazy">

    <div class="news-text">
      <div class="news-title">${n.title}</div>

      <div class="news-subtitle">
        ${shortText(n.subtitle || "", 140)}
      </div>

      <div class="news-date">
        <i class="far fa-clock"></i> ${date}
      </div>
    </div>
  `;

  div.onclick = () => {
    window.location.href = `article.html?slug=${n.slug}`;
  };

  return div;
}

/* ==========================
   JSON-LD ItemList cho Google
   ========================== */
function updateJsonLd(list) {
  if (!jsonLdEl) return;

  const itemListElement = list.map((n, idx) => ({
    "@type": "ListItem",
    "position": idx + 1,
    "url": `https://chatiip.com/article.html?slug=${n.slug}`,
    "name": n.title
  }));

  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": itemListElement
  };

  jsonLdEl.textContent = JSON.stringify(json, null, 2);
}

/* ==========================
   Phân trang từ workingList
   ========================== */

function resetPagination(list) {
  currentList = list;
  // bỏ bài đầu làm featured, phần còn lại để scroll
  workingList = list.slice(1);

  page = 1;
  noMore = false;
  loadingMore = false;

  listEl.innerHTML = "";
  featuredEl.innerHTML = "";

  if (list.length > 0) {
    renderFeaturedItem(list[0]);
  }

  appendMore(); // load trang đầu tiên
}

function appendMore() {
  if (noMore || workingList.length === 0) {
    loadingMore = false;
    return;
  }

  const start = (page - 1) * perPage;
  const end = page * perPage;
  const slice = workingList.slice(start, end);

  slice.forEach(n => listEl.appendChild(renderNewsItem(n)));

  if (end >= workingList.length) {
    noMore = true;
  }

  page++;
  loadingMore = false;
}

/* ==========================
   Load danh sách tin (lần đầu)
   ========================== */
async function loadNews() {
  showSkeleton();

  try {
    const res = await fetch(API);
    const data = await res.json();
    allNews = data || [];

    if (!Array.isArray(allNews) || allNews.length === 0) {
      featuredEl.innerHTML = "";
      listEl.innerHTML = `<p>Chưa có bài viết nào.</p>`;
      return;
    }

    // Sắp xếp mới nhất lên đầu
    allNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // reset + render theo phân trang
    resetPagination(allNews);

    // JSON-LD
    updateJsonLd(allNews);

  } catch (err) {
    console.error("Lỗi tải tin:", err);
    featuredEl.innerHTML = "";
    listEl.innerHTML = `
      <p style="color:red; text-align:center;">⚠️ Lỗi tải tin. Vui lòng thử lại.</p>
    `;
  }
}

loadNews();

/* ==========================
   FILTER + SEARCH (có infinite scroll)
   ========================== */

function applyFilters() {
  let filtered = [...allNews];

  const keyword = searchInput.value.toLowerCase().trim();
  const category = categoryFilter.value;

  // Lọc theo search
  if (keyword !== "") {
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(keyword) ||
      (n.subtitle || "").toLowerCase().includes(keyword) ||
      (n.content || "").toLowerCase().includes(keyword)
    );
  }

  // Lọc theo chuyên mục
  if (category !== "") {
    filtered = filtered.filter(n => n.category === category);
  }

  renderFilteredList(filtered);
}

function renderFilteredList(list) {
  if (!list || list.length === 0) {
    featuredEl.innerHTML = "";
    listEl.innerHTML = `<p style="padding:16px; color:#555;">Không tìm thấy bài viết nào.</p>`;
    updateJsonLd([]);
    return;
  }

  // dùng lại logic phân trang cho list đã lọc
  resetPagination(list);
  updateJsonLd(list);
}

// EVENT LISTENER cho filter
if (searchInput) {
  searchInput.addEventListener("input", () => {
    applyFilters();
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener("change", () => {
    applyFilters();
  });
}

/* ==========================
   INFINITE SCROLL
   ========================== */
window.addEventListener("scroll", () => {
  if (loadingMore || noMore) return;
  if (workingList.length === 0) return;

  // khi cuộn gần cuối trang 300px thì load tiếp
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadingMore = true;
    appendMore();
  }
});
