
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


// ====================  IIP MAP (INDUSTRIAL ZONES)  ====================
// Dùng MapLibre (KHÔNG cần token) + dữ liệu GeoJSON (industrial_zones.geojson)
const IIP_GEOJSON_PATH = "industrial_zones.geojson";
const IIP_GEOJSON_URL = `${IIP_GEOJSON_PATH}?v=${encodeURIComponent(window.CHATIIP_VERSION || "")}`;

const VN_PROVINCES_PATH = "vn_provinces.geojson";
const VN_PROVINCES_URL = `${VN_PROVINCES_PATH}?v=${encodeURIComponent(window.CHATIIP_VERSION || "")}`;

let __vnProvPromise = null;
let __vnProvIndex = null;

let __iipGeoPromise = null;
let __iipIndex = null;

// Chuẩn hoá tiếng Việt: bỏ dấu + lowercase để match ổn định
function normalizeViText(input) {
    return String(input ?? "")
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isIndustrialQuery(question) {
    const t = normalizeViText(question);
    return /(khu cong nghiep|kcn|cum cong nghiep|ccn|industrial\s*zone)/.test(t);
}

function buildIipIndex(geojson) {
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    const provincesSet = new Set();

    for (const f of features) {
        const p = String(f?.properties?.province ?? "").trim();
        if (p) provincesSet.add(p);
    }
    const provinces = Array.from(provincesSet).sort((a, b) => a.localeCompare(b, "vi"));

    const normProvinceToReal = new Map();
    provinces.forEach(p => normProvinceToReal.set(normalizeViText(p), p));

    return { features, provinces, normProvinceToReal };
}

async function getIndustrialGeojson() {
    // Offline-friendly: nếu đã có data global (từ industrial_zones_data.js) thì dùng luôn
    if (window.IIP_GEOJSON_DATA && window.IIP_GEOJSON_DATA.features) {
        __iipIndex = buildIipIndex(window.IIP_GEOJSON_DATA);
        return window.IIP_GEOJSON_DATA;
    }

    if (__iipGeoPromise) return __iipGeoPromise;

    __iipGeoPromise = fetch(IIP_GEOJSON_URL, { cache: "no-store" })
        .then(r => {
            if (!r.ok) throw new Error(`Không tải được ${IIP_GEOJSON_PATH} (HTTP ${r.status})`);
            return r.json();
        })
        .then(j => {
            __iipIndex = buildIipIndex(j);
            return j;
        })
        .catch(err => {
            console.warn("IIP GeoJSON load error:", err);
            __iipGeoPromise = null; // cho phép retry
            throw err;
        });

    return __iipGeoPromise;
}

async function getProvinceGeojson() {
    // Offline-friendly: nếu đã có data global (từ vn_provinces_data.js) thì dùng luôn
    if (window.VN_PROVINCES_GEOJSON && window.VN_PROVINCES_GEOJSON.features) {
        if (!__vnProvIndex) {
            __vnProvIndex = buildProvinceIndex(window.VN_PROVINCES_GEOJSON);
        }
        return window.VN_PROVINCES_GEOJSON;
    }

    if (__vnProvPromise) return __vnProvPromise;

    __vnProvPromise = fetch(VN_PROVINCES_URL, { cache: "no-store" })
        .then(r => {
            if (!r.ok) throw new Error(`Không tải được ${VN_PROVINCES_PATH} (HTTP ${r.status})`);
            return r.json();
        })
        .then(j => {
            __vnProvIndex = buildProvinceIndex(j);
            return j;
        })
        .catch(err => {
            console.warn("VN provinces GeoJSON load error:", err);
            __vnProvPromise = null;
            throw err;
        });

    return __vnProvPromise;
}

function buildProvinceIndex(geojson) {
    const features = Array.isArray(geojson?.features) ? geojson.features : [];
    const normToName = new Map();
    for (const f of features) {
        const name = String(f?.properties?.NAME_1 || f?.properties?.name || "").trim();
        if (!name) continue;
        normToName.set(normalizeViText(name), name);
    }
    return { features, normToName };
}

function mapProvinceNameToGeo(provinceText) {
    const norm = normalizeViText(provinceText);
    if (!norm || !__vnProvIndex?.normToName) return provinceText || "";
    return __vnProvIndex.normToName.get(norm) || provinceText || "";
}

function extractProvinceFromText(question) {
    const t = normalizeViText(question);
    if (!__iipIndex?.normProvinceToReal) return "";
    for (const [norm, real] of __iipIndex.normProvinceToReal.entries()) {
        if (norm && t.includes(norm)) return real;
    }
    return "";
}

function buildFeaturePopupHtml(feature) {
    const p = feature?.properties || {};
    const name = escapeHtmlGlobal(p.name || "Khu công nghiệp");
    const province = escapeHtmlGlobal(p.province || "");
    const address = escapeHtmlGlobal(p.address || "");
    const price = escapeHtmlGlobal(p.price || "");
    const acreage = (p.acreage !== undefined && p.acreage !== null) ? escapeHtmlGlobal(String(p.acreage)) : "";
    const occ = (p.occupancy !== undefined && p.occupancy !== null) ? escapeHtmlGlobal(String(p.occupancy)) : "";

    const coords = feature?.geometry?.coordinates || [];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);

    const googleQuery = encodeURIComponent(`${p.name || ""} ${p.address || ""}`.trim() || `${lat},${lng}`);
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${googleQuery}`;

    const rows = [
        province ? `<div><b>Tỉnh:</b> ${province}</div>` : "",
        address ? `<div><b>Địa chỉ:</b> ${address}</div>` : "",
        price ? `<div><b>Giá:</b> ${price}</div>` : "",
        acreage ? `<div><b>Diện tích:</b> ${acreage} ha</div>` : "",
        (occ !== "" && occ !== "null") ? `<div><b>Lấp đầy:</b> ${occ}%</div>` : "",
        `<div style="margin-top:8px;"><a class="chat-link" href="${gmaps}" target="_blank" rel="noopener noreferrer">Mở trên Google Maps</a></div>`
    ].filter(Boolean).join("");

    return `<div style="min-width:220px"><div style="font-weight:800;margin-bottom:6px">${name}</div>${rows}</div>`;
}

function uniqByCodeOrName(features) {
    const seen = new Set();
    const out = [];
    for (const f of features || []) {
        const p = f?.properties || {};
        const key = String(p.code || normalizeViText(p.name || "")).trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(f);
    }
    return out;
}

function matchFeaturesByItemNames(items, allFeatures) {
    const names = (items || [])
        .map(it => it?.name ?? it?.ten ?? it?.Tên ?? it?.Name ?? "")
        .map(s => String(s || "").trim())
        .filter(Boolean);

    if (!names.length) return [];

    const out = [];
    const features = allFeatures || [];

    for (const nm of names) {
        const n = normalizeViText(nm);
        if (!n) continue;

        let best = null;
        for (const f of features) {
            const fname = normalizeViText(f?.properties?.name || "");
            if (!fname) continue;

            if (fname === n || fname.includes(n) || n.includes(fname)) {
                best = f;
                break;
            }
        }
        if (best) out.push(best);
    }

    return uniqByCodeOrName(out);
}


function findBestFeatureByName(name, candidates) {
    const n = normalizeViText(name);
    if (!n) return null;
    let best = null;
    for (const f of candidates || []) {
        const fname = normalizeViText(f?.properties?.name || "");
        if (!fname) continue;
        if (fname === n || fname.includes(n) || n.includes(fname)) { best = f; break; }
    }
    return best;
}

function focusFeatureOnMap(map, feature) {
    try {
        if (!map || !feature) return;
        const c = feature?.geometry?.coordinates;
        if (!Array.isArray(c) || c.length < 2) return;
        const center = [Number(c[0]), Number(c[1])];
        map.easeTo({ center, zoom: 12, duration: 650 });

        new maplibregl.Popup({ closeButton: true, closeOnClick: true })
            .setLngLat(center)
            .setHTML(buildFeaturePopupHtml(feature))
            .addTo(map);
    } catch (_) {}
}

function filterFeaturesForQuestion(question, geojson) {
    const idx = __iipIndex || buildIipIndex(geojson);
    const features = idx.features || [];

    const province = extractProvinceFromText(question);
    let filtered = province
        ? features.filter(f => String(f?.properties?.province || "").trim() === province)
        : features.slice();

    // lấy token tìm kiếm (trừ stopwords) để match tên/địa chỉ
    const t = normalizeViText(question);
    const stop = new Set(["khu", "cong", "nghiep", "cum", "kcn", "ccn", "gia", "thue", "dat", "nha", "xuong", "tai", "o", "co", "la", "nhung", "bao", "nhieu", "so", "sanh", "gan", "nhat"]);
    const tokens = t.split(" ").filter(w => w.length >= 4 && !stop.has(w)).slice(0, 6);

    if (tokens.length) {
        filtered = filtered.filter(f => {
            const name = normalizeViText(f?.properties?.name || "");
            const addr = normalizeViText(f?.properties?.address || "");
            // match tất cả token
            return tokens.every(tok => name.includes(tok) || addr.includes(tok));
        });
    }

    // limit để map nhẹ (cluster vẫn ok nhưng UI mượt hơn)
    if (filtered.length > 400) filtered = filtered.slice(0, 400);
    return { filtered, province };
}

function buildGeojsonFromFeatures(features) {
    return {
        type: "FeatureCollection",
        features: (features || []).filter(Boolean)
    };
}

function createIipMapCard({ title, subtitle }) {
    const card = document.createElement("div");
    card.className = "iip-map-card";

    const head = document.createElement("div");
    head.className = "iip-map-head";

    const left = document.createElement("div");
    left.style.minWidth = "0";

    const t = document.createElement("div");
    t.className = "iip-map-title";
    t.textContent = title || "Bản đồ khu công nghiệp";

    const sub = document.createElement("div");
    sub.className = "iip-map-subtitle";
    sub.textContent = subtitle || "Bấm vào điểm để xem chi tiết.";

    left.appendChild(t);
    left.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "iip-map-actions";

    const btnFit = document.createElement("button");
    btnFit.className = "iip-map-btn";
    btnFit.type = "button";
    btnFit.innerHTML = '<i class="fa-solid fa-maximize"></i> Vừa khít';

    const btnTerrain = document.createElement("button");
    btnTerrain.className = "iip-map-btn";
    btnTerrain.type = "button";
    btnTerrain.innerHTML = '<i class="fa-solid fa-mountain"></i> Địa hình';
    btnTerrain.dataset.mode = "osm";

    const btnProvinces = document.createElement("button");
    btnProvinces.className = "iip-map-btn";
    btnProvinces.type = "button";
    btnProvinces.innerHTML = '<i class="fa-solid fa-layer-group"></i> Tỉnh';
    btnProvinces.dataset.on = "0";

    const btnToggle = document.createElement("button");
    btnToggle.className = "iip-map-btn";
    btnToggle.type = "button";
    btnToggle.innerHTML = '<i class="fa-solid fa-down-left-and-up-right-to-center"></i> Thu gọn';

    actions.appendChild(btnFit);
    actions.appendChild(btnTerrain);
    actions.appendChild(btnProvinces);
    actions.appendChild(btnToggle);

    head.appendChild(left);
    head.appendChild(actions);

    const mapWrap = document.createElement("div");
    mapWrap.className = "iip-map-wrap";

    // ✅ Mobile fix: allow MapLibre nhận touch/pointer để kéo/zoom
    // nhưng KHÓA scroll của chat khi người dùng đang tương tác với bản đồ.
    try {
        const chat = document.getElementById('chatContainer');

        const lock = () => { try { chat?.classList.add('map-interacting'); } catch (_) {} };
        const unlock = () => { try { chat?.classList.remove('map-interacting'); } catch (_) {} };

        // Touch: chặn scroll của chat (preventDefault) nhưng không stopPropagation
        mapWrap.addEventListener('touchstart', lock, { passive: true });
        mapWrap.addEventListener('touchend', unlock, { passive: true });
        mapWrap.addEventListener('touchcancel', unlock, { passive: true });
        mapWrap.addEventListener('touchmove', (e) => {
            lock();
            try { e.preventDefault(); } catch (_) {}
        }, { passive: false });

        // Pointer: khi giữ/drag (Android/Chrome)
        mapWrap.addEventListener('pointerdown', lock, { passive: true });
        mapWrap.addEventListener('pointerup', unlock, { passive: true });
        mapWrap.addEventListener('pointercancel', unlock, { passive: true });

        // Wheel (desktop trackpad): chặn scroll của chat để zoom map mượt
        mapWrap.addEventListener('wheel', (e) => {
            lock();
            try { e.preventDefault(); } catch (_) {}
            // thả lock nhanh để người dùng vẫn cuộn chat sau khi thôi zoom
            setTimeout(unlock, 120);
        }, { passive: false });
    } catch (_) {}


    const hint = document.createElement("div");
    hint.className = "iip-map-hint";
    hint.innerHTML = `• Click vào cụm để zoom. • Click vào điểm để xem popup.`;

    card.appendChild(head);
    card.appendChild(mapWrap);
    card.appendChild(hint);

    return { card, mapWrap, btnFit, btnToggle, btnTerrain, btnProvinces, hint, subEl: sub };
}


function createOsmStyle() {
    // 2 lớp nền: OSM (mặc định) + Địa hình (OpenTopoMap) + hillshade nhẹ
    return {
        version: 8,
        sources: {
            osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors"
            },
            topo: {
                type: "raster",
                tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png","https://b.tile.opentopomap.org/{z}/{x}/{y}.png","https://c.tile.opentopomap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenTopoMap (SRTM)"
            },
            hillshade: {
                type: "raster",
                tiles: ["https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "Hillshade: Wikimedia Labs"
            }
        },
        layers: [
            { id: "osm", type: "raster", source: "osm", layout: { visibility: "visible" } },
            { id: "topo", type: "raster", source: "topo", layout: { visibility: "none" } },
            { id: "hillshade", type: "raster", source: "hillshade", layout: { visibility: "none" }, paint: { "raster-opacity": 0.35 } }
        ]
    };
}

function setBasemapMode(map, mode = "osm") {
    try {
        const showOsm = mode !== "topo";
        const showTopo = mode === "topo";
        if (map.getLayer("osm")) map.setLayoutProperty("osm", "visibility", showOsm ? "visible" : "none");
        if (map.getLayer("topo")) map.setLayoutProperty("topo", "visibility", showTopo ? "visible" : "none");
        if (map.getLayer("hillshade")) map.setLayoutProperty("hillshade", "visibility", showTopo ? "visible" : "none");
    } catch (_) {}
}

function setProvinceLayerVisible(map, visible) {
    try {
        const v = visible ? "visible" : "none";
        ["province-fill", "province-line", "province-highlight", "province-label"].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
        });
    } catch (_) {}
}

function ensureMapIcons(map) {
    // icon trắng đơn giản (SVG) để hiển thị trên nền tròn
    const kcnSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M3 21V10l7-4v3l7-4v16H3zm2-2h2v-2H5v2zm0-4h2v-2H5v2zm4 4h2v-2H9v2zm0-4h2v-2H9v2zm4 4h2v-2h-2v2zm0-4h2v-2h-2v2z"/></svg>`;
    const ccnSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="M4 21V8l8-5 8 5v13H4zm2-2h3v-4H6v4zm5 0h3V9h-3v10zm5 0h3v-6h-3v6z"/></svg>`;

    const defs = [
        { name: 'kcn-icon', svg: kcnSvg },
        { name: 'ccn-icon', svg: ccnSvg }
    ];

    const tasks = defs.map(({ name, svg }) => {
        if (map.hasImage(name)) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try { map.addImage(name, img, { pixelRatio: 2 }); } catch (_) {}
                resolve();
            };
            img.onerror = () => resolve();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
    });

    return Promise.all(tasks);
}

async function addProvinceLayers(map, selectedProvinceText = "") {
    try {
        const provGeo = await getProvinceGeojson().catch(() => null);
        if (!provGeo) return;

        const sourceId = 'provinces';
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'geojson', data: provGeo });
        }

        // lớp fill mờ để bắt hover
        if (!map.getLayer('province-fill')) {
            map.addLayer({
                id: 'province-fill',
                type: 'fill',
                source: sourceId,
                paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.06 },
                layout: { visibility: 'none' }
            });
        }

        if (!map.getLayer('province-line')) {
            map.addLayer({
                id: 'province-line',
                type: 'line',
                source: sourceId,
                paint: { 'line-color': '#64748b', 'line-width': 1 },
                layout: { visibility: 'none' }
            });
        }

        if (!map.getLayer('province-highlight')) {
            map.addLayer({
                id: 'province-highlight',
                type: 'fill',
                source: sourceId,
                filter: ['==', ['get', 'NAME_1'], ''],
                paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.12, 'fill-outline-color': '#2563eb' },
                layout: { visibility: 'none' }
            });
        }

        // label (tắt mặc định vì có thể rối)
        if (!map.getLayer('province-label')) {
            map.addLayer({
                id: 'province-label',
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': ['get', 'NAME_1'],
                    'text-size': 11,
                    'text-allow-overlap': false,
                    'text-anchor': 'center',
                    visibility: 'none'
                },
                paint: { 'text-color': '#475569', 'text-halo-color': '#ffffff', 'text-halo-width': 1 }
            });
        }

        // highlight nếu có tỉnh trong câu hỏi
        const mapped = mapProvinceNameToGeo(selectedProvinceText);
        if (mapped && map.getLayer('province-highlight')) {
            map.setFilter('province-highlight', ['==', ['get', 'NAME_1'], mapped]);
        }

    } catch (e) {
        console.warn('addProvinceLayers error', e);
    }
}

function fitBoundsToFeatures(map, features) {
    try {
        if (!features || !features.length) return;
        const bounds = new maplibregl.LngLatBounds();
        for (const f of features) {
            const c = f?.geometry?.coordinates;
            if (Array.isArray(c) && c.length >= 2) bounds.extend([Number(c[0]), Number(c[1])]);
        }
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 600 });
        }
    } catch (e) { }
}

function renderIipMap(mapWrap, geojson, features, meta = {}) {
    if (typeof maplibregl === "undefined") {
        mapWrap.innerHTML = `<div class="iip-map-error">⚠️ Không tải được thư viện bản đồ (maplibre-gl.js).</div>`;
        return null;
    }

    // Nếu mapWrap đã có map trước đó → xoá
    try {
        if (mapWrap.__iipMap && typeof mapWrap.__iipMap.remove === "function") {
            mapWrap.__iipMap.remove();
        }
    } catch (_) { }

    const map = new maplibregl.Map({
        container: mapWrap,
        style: createOsmStyle(),
        center: [105.8342, 21.0278],
        zoom: 5.1
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    const useCluster = (features?.length || 0) > 40;
    const data = buildGeojsonFromFeatures(features?.length ? features : (geojson?.features || []));

    map.on("load", async () => {
        await ensureMapIcons(map);
        // Province layer (tắt mặc định)
        await addProvinceLayers(map, meta?.province || "");

        map.addSource("iip", {
            type: "geojson",
            data,
            cluster: useCluster,
            clusterMaxZoom: 12,
            clusterRadius: 42
        });

        if (useCluster) {
            map.addLayer({
                id: "clusters",
                type: "circle",
                source: "iip",
                filter: ["has", "point_count"],
                paint: {
                    "circle-radius": ["step", ["get", "point_count"], 18, 50, 22, 200, 28],
                    "circle-color": "#3b82f6",
                    "circle-opacity": 0.85
                }
            });

            map.addLayer({
                id: "cluster-count",
                type: "symbol",
                source: "iip",
                filter: ["has", "point_count"],
                layout: {
                    "text-field": ["get", "point_count_abbreviated"],
                    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                    "text-size": 12
                },
                paint: { "text-color": "#ffffff" }
            });
        }

        // nền tròn theo loại (KCN/CCN)
        map.addLayer({
            id: "point-halo",
            type: "circle",
            source: "iip",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-radius": 11,
                "circle-color": [
                    "case",
                    ["==", ["get", "kind"], "KCN"], "#2563eb",
                    ["==", ["get", "kind"], "CCN"], "#f97316",
                    "#ef4444"
                ],
                "circle-opacity": 0.88,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff"
            }
        });

        map.addLayer({
            id: "points",
            type: "symbol",
            source: "iip",
            filter: ["!", ["has", "point_count"]],
            layout: {
                "icon-image": [
                    "case",
                    ["==", ["get", "kind"], "CCN"], "ccn-icon",
                    "kcn-icon"
                ],
                "icon-size": 0.95,
                "icon-allow-overlap": true,
                "icon-anchor": "center"
            }
        });

        // click cluster → zoom
        if (useCluster) {
            map.on("click", "clusters", (e) => {
                const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
                const clusterId = features?.[0]?.properties?.cluster_id;
                const source = map.getSource("iip");
                if (!source || clusterId === undefined) return;

                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    map.easeTo({ center: features[0].geometry.coordinates, zoom });
                });
            });
            map.on("mouseenter", "clusters", () => map.getCanvas().style.cursor = "pointer");
            map.on("mouseleave", "clusters", () => map.getCanvas().style.cursor = "");
        }

        // click point → popup
        map.on("click", "points", (e) => {
            const f = e.features && e.features[0];
            if (!f) return;

            const coordinates = f.geometry.coordinates.slice();
            new maplibregl.Popup({ closeButton: true, closeOnClick: true })
                .setLngLat(coordinates)
                .setHTML(buildFeaturePopupHtml(f))
                .addTo(map);
        });
        map.on("mouseenter", "points", () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", "points", () => map.getCanvas().style.cursor = "");

        // fit bounds
        fitBoundsToFeatures(map, data.features);
    });

    mapWrap.__iipMap = map;
    return map;
}

async function appendIndustrialMapToBot(botEl, question, data) {
    if (!botEl) return false;
    if (botEl.querySelector(".iip-map-card")) return false;

    const visPre = (typeof extractExcelVisualize === "function") ? extractExcelVisualize(data) : null;
    if (!isIndustrialQuery(question) && !(visPre?.items?.length)) return false;

    let geo;
    try {
        geo = await getIndustrialGeojson();
    } catch (e) {
        // show error card
        const stack = botEl.querySelector(".bot-stack");
        const actions = botEl.querySelector(".message-actions");
        const card = document.createElement("div");
        card.className = "iip-map-card";
        card.innerHTML = `<div class="iip-map-error">⚠️ Không tải được dữ liệu bản đồ. Hãy chắc chắn file <b>${escapeHtmlGlobal(IIP_GEOJSON_PATH)}</b> nằm cùng thư mục với <b>index.html</b> và bạn chạy bằng server (Live Server / http.server).</div>`;
        if (stack && actions) stack.insertBefore(card, actions);
        else if (stack) stack.appendChild(card);
        else botEl.appendChild(card);
        return true;
    }

    // ưu tiên: nếu server trả excel_visualize → match theo items
    const vis = visPre;
    let r = null;

    let features = [];
    let subtitle = "";

    if (vis?.items?.length) {
        features = matchFeaturesByItemNames(vis.items, geo.features);
        subtitle = features.length
            ? `Hiển thị ${features.length} khu công nghiệp từ kết quả trả lời.`
            : "Không match được theo tên — hiển thị theo truy vấn.";
    }

    if (!features.length) {
        r = filterFeaturesForQuestion(question, geo);
        features = r.filtered;
        subtitle = r.province
            ? `Lọc theo tỉnh: ${r.province}. (${features.length} điểm)`
            : `Hiển thị theo truy vấn. (${features.length} điểm)`;
        // nếu vẫn trống thì show full dataset
        if (!features.length) {
            features = geo.features.slice();
            subtitle = `Hiển thị toàn bộ dữ liệu. (${features.length} điểm)`;
        }
    }

    const stack = botEl.querySelector(".bot-stack");
    const actions = botEl.querySelector(".message-actions");

    const { card, mapWrap, btnFit, btnToggle, btnTerrain, btnProvinces, hint, subEl } = createIipMapCard({
        title: "Bản đồ khu công nghiệp",
        subtitle
    });

    if (hint) hint.textContent = `• Click vào cụm để zoom. • Click vào điểm để xem chi tiết. • Tổng: ${features.length} điểm.`;

    if (stack && actions) stack.insertBefore(card, actions);
    else if (stack) stack.appendChild(card);
    else botEl.appendChild(card);

    // Force wide bubble
    try {
        const bubble = botEl.querySelector(".message-bubble");
        if (bubble) bubble.classList.add("wide");
    } catch (_) {}

    const map = renderIipMap(mapWrap, geo, features, { question, province: r?.province || vis?.province || "" });

    btnFit?.addEventListener("click", () => {
        try {
            if (!map) return;
            fitBoundsToFeatures(map, buildGeojsonFromFeatures(features).features);
        } catch (_) {}
    });

    btnToggle?.addEventListener("click", () => {
        const isHidden = mapWrap.style.display === "none";
        mapWrap.style.display = isHidden ? "" : "none";
        if (hint) hint.style.display = isHidden ? "" : "none";
        btnToggle.innerHTML = isHidden
            ? '<i class="fa-solid fa-down-left-and-up-right-to-center"></i> Thu gọn'
            : '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> Mở rộng';
        if (isHidden) {
            // khi mở lại: map cần resize
            try { map?.resize?.(); } catch (_) {}
        }
    });

    btnTerrain?.addEventListener("click", () => {
        if (!map) return;
        const current = btnTerrain.dataset.mode || "osm";
        const next = current === "topo" ? "osm" : "topo";
        btnTerrain.dataset.mode = next;
        btnTerrain.innerHTML = next === "topo"
            ? '<i class="fa-solid fa-map"></i> Nền thường'
            : '<i class="fa-solid fa-mountain"></i> Địa hình';
        setBasemapMode(map, next);
    });

    btnProvinces?.addEventListener("click", () => {
        if (!map) return;
        const on = (btnProvinces.dataset.on || "0") === "1";
        const next = !on;
        btnProvinces.dataset.on = next ? "1" : "0";
        btnProvinces.innerHTML = next
            ? '<i class="fa-solid fa-layer-group"></i> Tắt tỉnh'
            : '<i class="fa-solid fa-layer-group"></i> Tỉnh';
        setProvinceLayerVisible(map, next);
        // nếu có tỉnh trong query thì highlight khi bật
        if (next) {
            const pv = (r?.province || vis?.province || "");
            if (pv) {
                const mapped = mapProvinceNameToGeo(pv);
                try { map.setFilter('province-highlight', ['==', ['get', 'NAME_1'], mapped]); } catch (_) {}
            }
        }
    });


    // ✅ Click vào dòng trong bảng/thẻ để focus điểm trên bản đồ
    try {
        if (map) {
            const rows = botEl.querySelectorAll(".data-table tbody tr");
            rows.forEach(tr => {
                tr.style.cursor = "pointer";
                tr.addEventListener("click", () => {
                    const tds = tr.querySelectorAll("td");
                    const nameCell = tds && tds.length >= 2 ? tds[1] : null;
                    const nm = nameCell ? nameCell.textContent.trim() : "";
                    const f = findBestFeatureByName(nm, geo.features);
                    if (f) focusFeatureOnMap(map, f);
                });
            });

            const cards = botEl.querySelectorAll(".data-card .data-card-title");
            cards.forEach(node => {
                node.style.cursor = "pointer";
                node.addEventListener("click", () => {
                    const txt = node.textContent || "";
                    // format: "1. Tên KCN"
                    const nm = txt.replace(/^\s*\d+\.\s*/, "").trim();
                    const f = findBestFeatureByName(nm, geo.features);
                    if (f) focusFeatureOnMap(map, f);
                });
            });
        }
    } catch (_) {}

    setTimeout(scrollToBottom, 80);
    return true;
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
// Mobile viewport + iOS keyboard fix
// - Uses CSS vars: --app-height, --keyboard-offset
// =========================
const __rootStyle = document.documentElement.style;

function __setAppHeight() {
    try { __rootStyle.setProperty("--app-height", `${window.innerHeight}px`); } catch (_) {}
}

function __setKeyboardOffset() {
    try {
        if (!window.visualViewport) {
            __rootStyle.setProperty("--keyboard-offset", "0px");
            return;
        }
        const vv = window.visualViewport;
        const bottomInset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        __rootStyle.setProperty("--keyboard-offset", `${bottomInset}px`);
    } catch (_) {
        try { __rootStyle.setProperty("--keyboard-offset", "0px"); } catch (_) {}
    }
}

__setAppHeight();
__setKeyboardOffset();

window.addEventListener("resize", () => {
    __setAppHeight();
    __setKeyboardOffset();
});

if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", __setKeyboardOffset);
    window.visualViewport.addEventListener("scroll", __setKeyboardOffset);
}

// Keep latest message visible when keyboard opens/closes
// (Auto-scroll on focus/blur removed: only scroll on new user message or bot reply)

// =========================
// ⭐ FIX QUAN TRỌNG: Auto scroll (single-scroll container)
// =========================
function scrollToBottom(behavior = "smooth", force = false) {
    if (!chatContainer) return;
    // Khi đang sửa tin nhắn thì KHÔNG tự kéo xuống (đứng yên tại vị trí đang sửa)
    try {
        if (!force && !!chatContainer.querySelector('.user-message.editing')) return;
    } catch (_) {}
    requestAnimationFrame(() => {
        try {
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior });
        } catch (e) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });
}



    // =========================
    // Responsive helpers
    // =========================
    function isMobileViewport() {
        try {
            return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
        } catch (e) {
            return window.innerWidth <= 768;
        }
    }

    // =========================
    // Chart image preview overlay (zoom-friendly on mobile)
    // =========================
    function ensureImagePreviewOverlay() {
        let overlay = document.getElementById("imgPreviewOverlay");
        if (overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "imgPreviewOverlay";
        overlay.className = "img-preview-overlay";
        overlay.innerHTML = `
          <div class="img-preview-inner" role="dialog" aria-modal="true" aria-label="Xem biểu đồ">
            <button class="img-preview-close" type="button" aria-label="Đóng">
              <i class="fas fa-times"></i>
            </button>
            <img id="imgPreviewTarget" alt="Biểu đồ" />
          </div>
        `;

        document.body.appendChild(overlay);

        const close = () => {
            overlay.classList.remove("open");
            document.body.classList.remove("modal-open");
        };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector(".img-preview-close")?.addEventListener("click", close);
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay.classList.contains("open")) close();
        });

        return overlay;
    }

    function openImagePreview(src, alt) {
        const overlay = ensureImagePreviewOverlay();
        const img = document.getElementById("imgPreviewTarget");
        if (img) {
            img.src = src;
            img.alt = alt || "Biểu đồ";
        }
        overlay.classList.add("open");
        document.body.classList.add("modal-open");
    }

    function setDataBlockView(block, target) {
        if (!block) return;
        const tab = block.querySelector(`.data-view-tab[data-view-target="${target}"]`);
        if (tab && !tab.classList.contains("active")) tab.click();
    }

    function autoPreferCardsOnMobile(root) {
        if (!root || !isMobileViewport()) return;
        root.querySelectorAll?.(".data-block")?.forEach?.((block) => {
            if (block.querySelector('.data-view-tab[data-view-target="cards"]')) {
                setDataBlockView(block, "cards");
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
                const botEl = addBotMessage(answer, { messageId, question: message });

                handleExcelVisualizeResponse(data, botEl);

                // ✅ Luôn hiện bản đồ khi hỏi về KCN/CCN (hoặc khi server trả excel_visualize)
                Promise.resolve(appendIndustrialMapToBot(botEl, message, data)).catch(() => {});

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
        setTimeout(() => scrollToBottom("smooth", true), 50)
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
            let parsed = null;

            // ✅ Trường hợp server trả object/array trực tiếp (không phải string)
            if (rawMessage && typeof rawMessage === "object") {
                parsed = rawMessage;
            } else {
                let raw = String(rawMessage ?? "");
                raw = raw.trim();

                // chỉ thử parse nếu nhìn giống JSON
                const looksJson = /^[\[{]/.test(raw);
                if (looksJson) {
                    // parse thử nhiều lần vì đôi khi JSON bị bọc string nhiều lớp
                    try { parsed = JSON.parse(raw); } catch (_) {}
                    if (parsed && typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch (_) {} }
                    if (parsed && typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch (_) {} }
                }
            }

            // ✅ Render bảng + danh sách (thẻ) thay vì [object Object]
            if (parsed && typeof parsed === "object") {
                const arr =
                    (Array.isArray(parsed.data) && parsed.data) ||
                    (Array.isArray(parsed.items) && parsed.items) ||
                    (Array.isArray(parsed.results) && parsed.results) ||
                    (Array.isArray(parsed.list) && parsed.list) ||
                    null;

                if (Array.isArray(arr)) {
                    finalMessage = jsonToIndustrialTableV2(arr);
                } else if (Array.isArray(parsed)) {
                    finalMessage = jsonToIndustrialTableV2(parsed);
                } else {
                    // fallback: hiển thị JSON đẹp (đỡ khó chịu hơn object)
                    finalMessage = `<pre class="json-block">${escapeHtmlGlobal(JSON.stringify(parsed, null, 2))}</pre>`;
                }
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


        // Wide bubble for tables/charts so mobile doesn't feel cramped
        try {
            const bubble = botMessageElement.querySelector('.message-bubble');
            if (bubble) {
                const looksRich = /data-block|data-table|excel-viz/i.test(normalized.html);
                if (looksRich) bubble.classList.add('wide');
            }
        } catch (_) {}

        chatContainer.appendChild(botMessageElement);

        // Prefer cards on mobile for better UX
        try { autoPreferCardsOnMobile(botMessageElement); } catch (_) {}

        // ⭐ Auto scroll
        setTimeout(scrollToBottom, 50);

        // ⭐ Return element để có thể gắn chart/table vào đúng message
        return botMessageElement;
    }

    // ====================  EXCEL VISUALIZE (CHART/TABLE)  ====================
    function extractExcelVisualize(data) {
        if (!data || typeof data !== "object") return null;

        // Server đôi khi trả { type: "excel_visualize", payload: { type: "excel_visualize_price", ... } }
        const payload = (data.payload && typeof data.payload === "object") ? data.payload : null;

        const topType = data.type ? String(data.type) : "";
        const payloadType = payload?.type ? String(payload.type) : "";

        const looksLikeExcelViz =
            topType.includes("excel_visualize") ||
            payloadType.includes("excel_visualize");

        if (!looksLikeExcelViz) return null;

        // chart_base64 có thể nằm ở top-level hoặc trong payload
        const chartBase64 =
            (typeof data.chart_base64 === "string" && data.chart_base64.trim()) ? data.chart_base64.trim() :
            (typeof payload?.chart_base64 === "string" && payload.chart_base64.trim()) ? payload.chart_base64.trim() :
            "";

        const items = Array.isArray(payload?.items) ? payload.items : (Array.isArray(data.items) ? data.items : []);

        return {
            type: payloadType || topType,
            province: payload?.province || data.province || "",
            industrial_type: payload?.industrial_type || data.industrial_type || "",
            items,
            chart_base64: chartBase64
        };
    }

    function parsePriceNumber(priceStr) {
        const s = String(priceStr ?? "");
        // lấy số đầu tiên (110, 120, 65...)
        const m = s.replace(/,/g, ".").match(/(\d+(?:\.\d+)?)/);
        return m ? Number(m[1]) : NaN;
    }

    function buildPriceDataBlock(items, title = "Dữ liệu so sánh giá") {
        const block = document.createElement("div");
        block.className = "data-block";

        const rows = (items || []).map((it, idx) => {
            const name = escapeHtmlGlobal(it?.name ?? it?.ten ?? it?.Tên ?? "");
            const price = escapeHtmlGlobal(it?.price ?? it?.gia ?? it?.Giá ?? "");
            return `
              <tr>
                <td class="col-stt">${idx + 1}</td>
                <td>${name || "—"}</td>
                <td class="col-area">${price || "—"}</td>
              </tr>
            `;
        }).join("");

        const cards = (items || []).map((it, idx) => {
            const name = escapeHtmlGlobal(it?.name ?? it?.ten ?? it?.Tên ?? "");
            const price = escapeHtmlGlobal(it?.price ?? it?.gia ?? it?.Giá ?? "");
            return `
              <div class="data-card">
                <div class="data-card-head">
                  <div class="data-card-title">${name || "—"}</div>
                  <div class="data-card-badge">#${idx + 1}</div>
                </div>
                <div class="data-card-line">
                  <div class="data-card-label">Giá</div>
                  <div class="data-card-value">${price || "—"}</div>
                </div>
              </div>
            `;
        }).join("");

        block.innerHTML = `
          <div class="data-block-toolbar">
            <div class="data-block-title">${escapeHtmlGlobal(title)}</div>
            <div class="data-view-tabs" role="tablist" aria-label="Chế độ xem">
              <button class="data-view-tab active" type="button" data-view-target="table" role="tab" aria-selected="true">
                <i class="fa-solid fa-table"></i> Bảng
              </button>
              <button class="data-view-tab" type="button" data-view-target="cards" role="tab" aria-selected="false">
                <i class="fa-solid fa-grip"></i> Thẻ
              </button>
            </div>
          </div>

          <div class="data-panel active" data-view-panel="table">
            <div class="data-table-wrap">
              <table class="data-table data-table-compact">
                <thead>
                  <tr>
                    <th class="col-stt">#</th>
                    <th>Khu công nghiệp</th>
                    <th class="col-area">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || `<tr><td colspan="3">Không có dữ liệu.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="data-panel" data-view-panel="cards">
            <div class="data-cards-wrap">
              <div class="data-cards">
                ${cards || `<div class="data-card"><div class="data-card-title">Không có dữ liệu.</div></div>`}
              </div>
            </div>
          </div>
        `;

        return block;
    }

    function buildBarChart(items, titleText = "Biểu đồ so sánh giá") {
        const wrap = document.createElement("div");
        wrap.className = "excel-viz-chart";
        wrap.style.border = "1px solid var(--border)";
        wrap.style.borderRadius = "16px";
        wrap.style.background = "var(--surface)";
        wrap.style.padding = "12px";
        wrap.style.marginTop = "10px";

        const title = document.createElement("div");
        title.style.fontSize = "13px";
        title.style.fontWeight = "700";
        title.style.color = "var(--title)";
        title.style.marginBottom = "10px";
        title.textContent = titleText;
        wrap.appendChild(title);

        const values = (items || []).map(it => parsePriceNumber(it?.price)).filter(v => Number.isFinite(v));
        const maxV = values.length ? Math.max(...values) : 0;

        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "10px";

        (items || []).forEach(it => {
            const nameRaw = String(it?.name ?? "");
            const priceRaw = String(it?.price ?? "");
            const v = parsePriceNumber(priceRaw);
            const pct = (Number.isFinite(v) && maxV > 0) ? Math.max(2, Math.round((v / maxV) * 100)) : 0;

            const row = document.createElement("div");

            const label = document.createElement("div");
            label.style.display = "flex";
            label.style.alignItems = "baseline";
            label.style.justifyContent = "space-between";
            label.style.gap = "10px";
            label.style.marginBottom = "6px";

            const left = document.createElement("div");
            left.style.fontSize = "13px";
            left.style.color = "var(--title)";
            left.style.fontWeight = "600";
            left.style.lineHeight = "1.35";
            left.textContent = nameRaw || "—";

            const right = document.createElement("div");
            right.style.fontSize = "12px";
            right.style.color = "var(--muted)";
            right.style.whiteSpace = "nowrap";
            right.textContent = priceRaw || "—";

            label.appendChild(left);
            label.appendChild(right);

            const barOuter = document.createElement("div");
            barOuter.style.height = "10px";
            barOuter.style.background = "var(--surface2)";
            barOuter.style.border = "1px solid var(--border)";
            barOuter.style.borderRadius = "999px";
            barOuter.style.overflow = "hidden";

            const barInner = document.createElement("div");
            barInner.style.height = "100%";
            barInner.style.width = pct ? `${pct}%` : "0%";
            barInner.style.background = "var(--primary-bg)"; // đồng nhất theme
            barInner.style.borderRadius = "999px";
            barOuter.appendChild(barInner);

            row.appendChild(label);
            row.appendChild(barOuter);
            list.appendChild(row);
        });

        wrap.appendChild(list);
        return wrap;
    }

    function handleExcelVisualizeResponse(data, botEl) {
        const vis = extractExcelVisualize(data);
        if (!vis || !botEl) return false;

        // remove viz cũ nếu có (khi regenerate/edit)
        botEl.querySelectorAll(".excel-viz").forEach(n => n.remove());

        const stack = botEl.querySelector(".bot-stack");
        const actions = botEl.querySelector(".message-actions");

        const vizWrap = document.createElement("div");
        vizWrap.className = "excel-viz";
        vizWrap.style.marginTop = "10px";

        const titleParts = [];
        if (vis.industrial_type) titleParts.push(vis.industrial_type);
        if (vis.province) titleParts.push(vis.province);
        const titleText = titleParts.length ? `Biểu đồ so sánh giá (${titleParts.join(" - ")})` : "Biểu đồ so sánh giá";

        if (vis.chart_base64) {
            const img = document.createElement("img");
            img.alt = titleText;
            img.src = "data:image/png;base64," + vis.chart_base64;
            img.style.maxWidth = "100%";
            img.style.display = "block";
            img.style.borderRadius = "16px";
            img.style.border = "1px solid var(--border)";
            img.style.boxShadow = "0 12px 30px rgba(0,0,0,0.06)";
            img.addEventListener("click", () => openImagePreview(img.src, img.alt));
            vizWrap.appendChild(img);
        } else if (Array.isArray(vis.items) && vis.items.length) {
            // Fallback: server không trả base64 → vẽ chart HTML bằng CSS
            vizWrap.appendChild(buildBarChart(vis.items, titleText));
        }

        // luôn kèm bảng cho dễ đối chiếu
        if (Array.isArray(vis.items) && vis.items.length) {
            vizWrap.appendChild(buildPriceDataBlock(vis.items, "Dữ liệu so sánh giá"));
        }

        // Force wide bubble + prefer cards on mobile
        try {
            const bubble = botEl.querySelector('.message-bubble');
            if (bubble) bubble.classList.add('wide');
            autoPreferCardsOnMobile(botEl);
        } catch (_) {}

        if (stack && actions) stack.insertBefore(vizWrap, actions);
        else if (stack) stack.appendChild(vizWrap);
        else botEl.appendChild(vizWrap);

        setTimeout(scrollToBottom, 80);
        return true;
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
            handleExcelVisualizeResponse(data, botEl);

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
        try { userEl.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
    }

    async function postChat(question) {
        const res = await fetch('https://luat-lao-dong.onrender.com/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await res.json();
        return data;
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
            const data = await postChat(newText);
            hideTypingIndicator();
            const answer = data?.answer || data?.reply || 'No response.';
            const botEl = addBotMessage(answer, { messageId, question: newText });
            handleExcelVisualizeResponse(data, botEl);

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
                const botEl = addBotMessage(answer, { messageId, question: text });

                handleExcelVisualizeResponse(data, botEl);

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

    // (Removed) Mobile focus/blur auto-scroll: caused jump when opening keyboard on phones.



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
            window.location.href = "news.html?v=" + encodeURIComponent(window.CHATIIP_VERSION || "");
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

        // Không auto-scroll khi chỉ đổi chế độ xem (Bảng/Thẻ).

    });

    // ⭐ Auto scroll: chỉ khi thêm message mới (không scroll khi tương tác map / tile load)
    try {
        const chatObserver = new MutationObserver((mutations) => {
            let should = false;
            for (const mu of mutations) {
                for (const node of (mu.addedNodes || [])) {
                    if (node && node.nodeType === 1 && node.classList && node.classList.contains("message")) {
                        should = true;
                        break;
                    }
                }
                if (should) break;
            }
            if (should) scrollToBottom();
        });
        // chỉ quan sát các con trực tiếp của chatContainer → tránh trigger bởi DOM thay đổi bên trong bản đồ
        chatObserver.observe(chatContainer, { childList: true, subtree: false });
    } catch (e) {
        // ignore
    }

});

