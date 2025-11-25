let allNews = [];

// API backend
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:4000/api/news"
    : "https://admin.chatiip.com/api/news";

const featuredEl = document.getElementById("featuredNews");
const listEl = document.getElementById("newsList");
const jsonLdEl = document.getElementById("newsJsonLd");

/* ====== Skeleton loading ====== */
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

/* ====== Cắt ngắn text ====== */
function shortText(text, max = 120) {
  if (!text) return "";
  const clean = String(text);
  return clean.length > max ? clean.slice(0, max) + "..." : clean;
}

/* ====== Render bài nổi bật ====== */
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

  // Click vào ảnh hoặc title → vào bài
  const go = () => {
    window.location.href = `article.html?slug=${n.slug}`;
  };
  featuredEl.querySelector(".featured-image-wrap").onclick = go;
  featuredEl.querySelector("#featuredTitle").onclick = go;
}

/* ====== Render từng bài còn lại ====== */
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

/* ====== Cập nhật JSON-LD ItemList cho Google ====== */
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

/* ====== Load danh sách tin ====== */
async function loadNews() {
  showSkeleton();

  try {
    const res = await fetch(API);
    const data = await res.json();
    allNews = data;


    if (!Array.isArray(data) || data.length === 0) {
      featuredEl.innerHTML = "";
      listEl.innerHTML = `<p>Chưa có bài viết nào.</p>`;
      return;
    }

    // Sắp xếp theo ngày mới nhất
    data.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Bài nổi bật = bài mới nhất
    const [featured, ...rest] = data;
    renderFeaturedItem(featured);

    // Danh sách còn lại
    listEl.innerHTML = "";
    rest.forEach(n => listEl.appendChild(renderNewsItem(n)));

    if (rest.length === 0) {
      listEl.innerHTML = `<p>Chỉ có 1 bài viết trong mục này.</p>`;
    }

    // JSON-LD
    updateJsonLd(data);

  } catch (err) {
    console.error("Lỗi tải tin:", err);
    featuredEl.innerHTML = "";
    listEl.innerHTML = `
      <p style="color:red; text-align:center;">⚠️ Lỗi tải tin. Vui lòng thử lại.</p>
    `;
  }
}

loadNews();



// ======================================================
//  FILTER + SEARCH
// ======================================================

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

    // Lọc theo category
    if (category !== "") {
        filtered = filtered.filter(n => n.category === category);
    }

    renderFilteredList(filtered);
    featuredEl.innerHTML = "";

}

function renderFilteredList(list) {
    listEl.innerHTML = "";

    if (list.length === 0) {
        listEl.innerHTML = `<p style="padding:16px; color:#555;">Không tìm thấy bài viết nào.</p>`;
        return;
    }

    // bài nổi bật mới sau lọc
    const [featured, ...rest] = list;
    renderFeaturedItem(featured);

    // render danh sách còn lại
    rest.forEach(n => listEl.appendChild(renderNewsItem(n)));

    // JSON-LD update
    updateJsonLd(list);
}

// EVENT LISTENER
searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

