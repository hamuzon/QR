(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (err) { }
    }
  };
  function selectMode(panelId, updateURL) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === panelId);
    });
    document.querySelectorAll(".panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });
    if (updateURL) {
      try {
        const url = new URL(location.href);
        if (panelId === "panel-read") {
          url.searchParams.set("mode", "Read");
        } else {
          url.searchParams.delete("mode");
        }
        history.replaceState(null, "", url);
      } catch (err) { }
    }
  }
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectMode(btn.dataset.panel, true));
  });
  const initialMode = (new URLSearchParams(location.search).get("mode") || "").toLowerCase() === "read"
    ? "panel-read"
    : "panel-make";
  selectMode(initialMode, true);
  const frontInput = $("front");
  const hiddenInput = $("hidden");
  const makeBtn = $("makeBtn");
  const resetMakeBtn = $("resetMakeBtn");
  const makeStatus = $("makeStatus");
  const makeOut = $("makeOut");
  const qrCanvas = $("qr");
  const download = $("download");
  frontInput.value = storage.get("qrsteg.front", "");
  hiddenInput.value = storage.get("qrsteg.hidden", "");
  const AUTO_OPTIONS = { level: "H", cap: 0.7 };
  function drawMatrix(canvas, matrix, scale, quiet) {
    const n = matrix.length;
    const size = (n + quiet * 2) * scale;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (matrix[y][x]) {
          ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }
      }
    }
  }
  function renderMake() {
    const front = frontInput.value;
    const hidden = hiddenInput.value;
    if (!front) {
      makeStatus.textContent = "中身を入力してください / Please enter the front content.";
      makeStatus.className = "status";
      makeOut.classList.remove("visible");
      return;
    }
    let result;
    try {
      result = QRSteg.make(front, hidden, AUTO_OPTIONS);
    } catch (err) {
      makeStatus.textContent = "作成に失敗しました / Failed: " + (err.message || err);
      makeStatus.className = "status error";
      makeOut.classList.remove("visible");
      return;
    }
    if (result.error) {
      makeStatus.textContent = result.error === "front"
        ? "中身が長すぎます / The front content is too long."
        : "隠すメッセージが長すぎます。メッセージを短くしてください。 / The hidden message is too long. Shorten it.";
      makeStatus.className = "status error";
      makeOut.classList.remove("visible");
      return;
    }
    drawMatrix(qrCanvas, result.matrix, 8, 4);
    makeOut.classList.add("visible");
    download.href = qrCanvas.toDataURL("image/png");
    makeStatus.textContent = "";
    makeStatus.className = "status";
  }
  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderMake, 250);
  }
  frontInput.addEventListener("input", () => {
    storage.set("qrsteg.front", frontInput.value);
    scheduleRender();
  });
  hiddenInput.addEventListener("input", () => {
    storage.set("qrsteg.hidden", hiddenInput.value);
    scheduleRender();
  });
  makeBtn.addEventListener("click", renderMake);
  resetMakeBtn.addEventListener("click", () => {
    frontInput.value = "";
    hiddenInput.value = "";
    storage.set("qrsteg.front", "");
    storage.set("qrsteg.hidden", "");
    makeStatus.textContent = "";
    makeStatus.className = "status";
    makeOut.classList.remove("visible");
    download.href = "#";
    frontInput.focus();
  });
  if (frontInput.value) renderMake();
  download.addEventListener("click", () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    download.download = "qr-Code-hamu-Steganography_" + yyyy + "-" + mm + "-" + dd + "_" + hh + "-" + mi + "-" + ss + ".png";
  });
  const urlInput = $("urlInput");
  const urlBtn = $("urlBtn");
  try {
    localStorage.removeItem("qrsteg.url");
  } catch (err) { }
  const fileInput = $("fileInput");
  const dropZone = $("dropZone");
  const cameraSelect = $("cameraSelect");
  const camToggleBtn = $("camToggleBtn");
  const cameraControls = $("cameraControls");
  const torchBtn = $("torchBtn");
  const readerWrap = $("readerWrap");
  const readerEl = $("reader");
    const readStatus = $("readStatus");
  const readOut = $("readOut");
  const outFront = $("outFront");
  const outHidden = $("outHidden");
  const hiddenItem = $("hiddenItem");
  const resetBtn = $("resetBtn");
  const MAX_SCAN_DIM = 1600;
  function setStatus(text, kind) {
    readStatus.textContent = text || "";
    readStatus.className = "status" + (kind ? " " + kind : "");
  }
  function setReadError(text) {
    readOut.classList.remove("visible");
    setStatus(text, "error");
  }
  function isURL(text) {
    return /^https?:\/\//i.test(text);
  }
  function showResult(result) {
    readOut.classList.add("visible");
    outFront.textContent = "";
    if (isURL(result.front)) {
      const link = document.createElement("a");
      link.href = result.front;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = result.front;
      outFront.appendChild(link);
    } else {
      outFront.textContent = result.front;
    }
    const info = result.info;
    if (info && info.ok && info.hidden !== null) {
      outHidden.textContent = info.hidden;
      outHidden.classList.remove("muted");
      hiddenItem.style.display = "";
    } else {
      outHidden.textContent = "";
      outHidden.classList.add("muted");
      hiddenItem.style.display = "none";
    }
    setStatus("", "");
  }
  function sampleMatrix(imageData, version, location) {
    const n = 17 + 4 * version;
    const TL = location.topLeftCorner;
    const TR = location.topRightCorner;
    const BL = location.bottomLeftCorner;
    const BR = location.bottomRightCorner;
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    function grayAt(px, py) {
      const x = Math.max(0, Math.min(width - 1, px));
      const y = Math.max(0, Math.min(height - 1, py));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = x - x0;
      const fy = y - y0;
      function at(xx, yy) {
        const index = (yy * width + xx) * 4;
        return data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      }
      const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx;
      const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx;
      return top * (1 - fy) + bottom * fy;
    }
    const p0 = TL;
    const p1 = TR;
    const p2 = BR;
    const p3 = BL;
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const dy3 = p0.y - p1.y + p2.y - p3.y;
    const den = dx1 * dy2 - dx2 * dy1;
    let a, b, c, d, e, f, g, h;
    if (Math.abs(den) < 1e-9) {
      a = p1.x - p0.x; b = p3.x - p0.x; c = p0.x;
      d = p1.y - p0.y; e = p3.y - p0.y; f = p0.y;
      g = 0; h = 0;
    } else if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
      a = p1.x - p0.x; b = p3.x - p0.x; c = p0.x;
      d = p1.y - p0.y; e = p3.y - p0.y; f = p0.y;
      g = 0; h = 0;
    } else {
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dx3 * dy1) / den;
      a = p1.x - p0.x + g * p1.x;
      b = p3.x - p0.x + h * p3.x;
      c = p0.x;
      d = p1.y - p0.y + g * p1.y;
      e = p3.y - p0.y + h * p3.y;
      f = p0.y;
    }
    function mapPoint(u, v) {
      const w = g * u + h * v + 1 || 1;
      return {
        x: (a * u + b * v + c) / w,
        y: (d * u + e * v + f) / w
      };
    }
    const offsets = [
      [0, 0],
      [-0.22, 0],
      [0.22, 0],
      [0, -0.22],
      [0, 0.22]
    ];
    return (x, y) => {
      let dark = 0;
      for (let i = 0; i < offsets.length; i++) {
        const u = (x + 0.5 + offsets[i][0]) / n;
        const v = (y + 0.5 + offsets[i][1]) / n;
        const point = mapPoint(u, v);
        if (grayAt(point.x, point.y) < 128) dark++;
      }
      return dark >= 3 ? 1 : 0;
    };
  }
  function decodeImageData(imageData) {
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });
    if (!code) return null;
    const version = code.version;
    let info = null;
    if (version) {
      const sample = sampleMatrix(imageData, version, code.location);
      const n = 17 + 4 * version;
      const variants = [
        (x, y) => sample(x, y),
        (x, y) => sample(y, x),
        (x, y) => sample(n - 1 - x, y),
        (x, y) => sample(x, n - 1 - y),
        (x, y) => sample(n - 1 - x, n - 1 - y),
        (x, y) => sample(y, n - 1 - x),
        (x, y) => sample(n - 1 - y, x),
        (x, y) => sample(n - 1 - y, n - 1 - x)
      ];
      for (let i = 0; i < variants.length; i++) {
        try {
          const candidate = QRSteg.readMatrix(variants[i], version);
          if (candidate && candidate.ok) {
            info = candidate;
            break;
          }
        } catch (err) { }
      }
    }
    return { front: code.data, version: version || null, info: info };
  }
  function binarizeImageData(imageData) {
    const src = imageData.data;
    const length = src.length / 4;
    const gray = new Uint8Array(length);
    const histogram = new Int32Array(256);
    for (let i = 0; i < length; i++) {
      const offset = i * 4;
      const value = Math.round(src[offset] * 0.299 + src[offset + 1] * 0.587 + src[offset + 2] * 0.114);
      gray[i] = value;
      histogram[value]++;
    }
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let sumB = 0;
    let weightB = 0;
    let maxVariance = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
      weightB += histogram[t];
      if (weightB === 0) continue;
      const weightF = length - weightB;
      if (weightF === 0) break;
      sumB += t * histogram[t];
      const meanB = sumB / weightB;
      const meanF = (sum - sumB) / weightF;
      const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
      if (between > maxVariance) {
        maxVariance = between;
        threshold = t;
      }
    }
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < length; i++) {
      const value = gray[i] >= threshold ? 255 : 0;
      const offset = i * 4;
      out[offset] = value;
      out[offset + 1] = value;
      out[offset + 2] = value;
      out[offset + 3] = 255;
    }
    return new ImageData(out, imageData.width, imageData.height);
  }
  function invertImageData(imageData) {
    const src = imageData.data;
    const out = new Uint8ClampedArray(src.length);
    for (let i = 0; i < src.length; i += 4) {
      out[i] = 255 - src[i];
      out[i + 1] = 255 - src[i + 1];
      out[i + 2] = 255 - src[i + 2];
      out[i + 3] = 255;
    }
    return new ImageData(out, imageData.width, imageData.height);
  }
  async function scanImageElement(img, file) {
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;
    if (!origW || !origH) {
      setReadError("画像を読み込めませんでした / Could not load the image.");
      return;
    }
    const targets = [origW, 1200, 900, 700, 500, 1600];
    const seen = new Set();
    const scales = [];
    for (let i = 0; i < targets.length; i++) {
      const scale = Math.min(targets[i] / origW, targets[i] / origH, 1);
      const key = Math.round(scale * 1000);
      if (!seen.has(key) && scale > 0.05) {
        seen.add(key);
        scales.push(scale);
      }
    }
    let fallback = null;
    for (let s = 0; s < scales.length; s++) {
      const width = Math.max(1, Math.round(origW * scales[s]));
      const height = Math.max(1, Math.round(origH * scales[s]));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      const original = ctx.getImageData(0, 0, width, height);
      const binarized = binarizeImageData(original);
      const inverted = invertImageData(binarized);
      const variants = [original, binarized, inverted];
      for (let v = 0; v < variants.length; v++) {
        const result = decodeImageData(variants[v]);
        if (!result) continue;
        if (result.info && result.info.ok && result.info.hidden !== null) {
          showResult(result);
          return;
        }
        if (!fallback || (result.info && result.info.ok)) {
          fallback = result;
        }
      }
    }
    if (fallback) {
      showResult(fallback);
      setStatus("隠されたメッセージ... はありませんでした。 / No hidden message was found.", "warn");
      return;
    }
    if (file && html5QrCode && typeof html5QrCode.scanFile === "function") {
      try {
        const barcodeText = await html5QrCode.scanFile(file, false);
        if (barcodeText) {
          showResult({ front: barcodeText, version: null, info: null });
          setStatus("バーコードを読み取りました。 / Barcode scanned: " + barcodeText, "ok");
          return;
        }
      } catch (e) { }
    }
    if (typeof window.BarcodeDetector !== "undefined") {
      try {
        const formats = await BarcodeDetector.getSupportedFormats();
        const detector = new BarcodeDetector({ formats: formats });
        const detected = await detector.detect(img);
        if (detected && detected.length > 0) {
          const val = detected[0].rawValue;
          const fmt = detected[0].format || "BARCODE";
          showResult({ front: val, version: null, info: null });
          setStatus(`バーコード (${fmt}) を読み取りました。 / Barcode found.`, "ok");
          return;
        }
      } catch (e) { }
    }
    setReadError("QRコード / バーコードが見つかりませんでした / No QR code or barcode was found.");
  }
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("画像を読み込めませんでした / Could not load the image."));
      };
      img.src = url;
    });
  }
  function loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (/^https?:\/\//i.test(url)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("画像を読み込めませんでした（CORSの可能性があります） / Could not load the image (possibly CORS)."));
      img.src = url;
    });
  }
  async function scanFile(file) {
    setStatus("読み込んでいます... / Loading...", "");
    readOut.classList.remove("visible");
    try {
      const img = await loadImageFromFile(file);
      await scanImageElement(img, file);
    } catch (err) {
      setReadError(err.message);
    }
  }
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) scanFile(file);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach((event) => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((event) => {
    dropZone.addEventListener(event, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) scanFile(file);
  });
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) scanFile(file);
        break;
      }
    }
  });
  async function loadFromURL() {
    const url = urlInput.value.trim();
    if (!url) {
      setReadError("URLを入力してください / Please enter a URL.");
      return;
    }
    setStatus("読み込んでいます... / Loading...", "");
    readOut.classList.remove("visible");
    try {
      const img = await loadImageFromURL(url);
      await scanImageElement(img);
    } catch (err) {
      setReadError(err.message);
    }
  }
  urlBtn.addEventListener("click", loadFromURL);
  urlInput.addEventListener("input", () => {
    storage.set("qrsteg.url", urlInput.value);
  });
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadFromURL();
  });
  const formatsToSupport = typeof Html5QrcodeSupportedFormats !== "undefined"
    ? [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.AZTEC,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.MAXICODE,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.PDF_417,
      Html5QrcodeSupportedFormats.RSS_14,
      Html5QrcodeSupportedFormats.RSS_EXPANDED,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
    ]
    : undefined;
  const html5QrCode = typeof Html5Qrcode !== "undefined"
    ? new Html5Qrcode("reader", formatsToSupport ? { formatsToSupport, verbose: false } : false)
    : null;
  let videoEl = null;
  let raf = null;
  let scanning = false;
  let isSwitchingCamera = false;
  let lastScan = 0;
  let torchOn = false;
  let torchSupported = false;
  const workCanvas = document.createElement("canvas");
  let lastShownFront = null;
  let lastShownHidden = null;
  function triggerScanBorder() {
    if (readerWrap) {
      readerWrap.classList.remove("scanned");
      void readerWrap.offsetWidth;
      readerWrap.classList.add("scanned");
      setTimeout(() => {
        if (readerWrap) readerWrap.classList.remove("scanned");
      }, 300);
    }
  }
  function getVideoTrack() {
    if (!videoEl) videoEl = readerEl.querySelector("video");
    if (videoEl && videoEl.srcObject && typeof videoEl.srcObject.getVideoTracks === "function") {
      const tracks = videoEl.srcObject.getVideoTracks();
      if (tracks && tracks.length > 0) return tracks[0];
    }
    return null;
  }
  async function listCameras(preserveSelection = true) {
    if (typeof Html5Qrcode === "undefined") return;
    const loadingTimer = setTimeout(() => {
      const first = cameraSelect.options[0];
      if (cameraSelect.options.length === 1 && first && /読み込んでいます|Loading/.test(first.textContent)) {
        first.textContent = "カメラが見つかりません / No camera found";
      }
    }, 5000);
    try {
      const cameras = await Html5Qrcode.getCameras();
      clearTimeout(loadingTimer);
      const currentVal = cameraSelect.value;
      cameraSelect.innerHTML = "";
      if (!cameras || !cameras.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "カメラが見つかりません / No camera found";
        cameraSelect.appendChild(option);
        return;
      }
      cameras.forEach((camera, index) => {
        const option = document.createElement("option");
        option.value = camera.id;
        option.textContent = camera.label || "カメラ " + (index + 1);
        cameraSelect.appendChild(option);
      });
      if (preserveSelection && currentVal && cameras.some((camera) => camera.id === currentVal)) {
        cameraSelect.value = currentVal;
      } else {
        const track = getVideoTrack();
        const activeDeviceId = track && typeof track.getSettings === "function" ? track.getSettings().deviceId : null;
        if (activeDeviceId && cameras.some((camera) => camera.id === activeDeviceId)) {
          cameraSelect.value = activeDeviceId;
        } else {
          const back = cameras.find((camera) => /back|rear|environment/i.test(camera.label || ""));
          if (back) {
            cameraSelect.value = back.id;
          } else {
            cameraSelect.value = cameras[0].id;
          }
        }
      }
    } catch (err) {
      clearTimeout(loadingTimer);
      if (!cameraSelect.options.length || cameraSelect.value === "") {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "カメラ権限が必要です / Camera permission required";
        cameraSelect.innerHTML = "";
        cameraSelect.appendChild(option);
      }
    }
  }
  listCameras(false);
  function checkTorchCapability() {
    if (!scanning) {
      torchSupported = false;
      torchBtn.style.display = "none";
      cameraControls.classList.remove("has-torch");
      return;
    }
    let hasTorch = false;
    const track = getVideoTrack();
    if (track && typeof track.getCapabilities === "function") {
      try {
        const caps = track.getCapabilities();
        if (caps && caps.torch) {
          hasTorch = true;
        }
      } catch (err) { }
    }
    if (!hasTorch && html5QrCode) {
      try {
        if (typeof html5QrCode.getRunningTrackCapabilities === "function") {
          const caps = html5QrCode.getRunningTrackCapabilities();
          if (caps && caps.torch) hasTorch = true;
        }
      } catch (err) { }
      try {
        if (!hasTorch && typeof html5QrCode.getRunningTrackCameraCapabilities === "function") {
          const camCaps = html5QrCode.getRunningTrackCameraCapabilities();
          if (camCaps && typeof camCaps.hasTorch === "function" && camCaps.hasTorch()) {
            hasTorch = true;
          }
        }
      } catch (err) { }
    }
    torchSupported = hasTorch;
    if (torchSupported) {
      torchBtn.style.display = "inline-block";
      cameraControls.classList.add("has-torch");
    } else {
      torchBtn.style.display = "none";
      cameraControls.classList.remove("has-torch");
      torchOn = false;
      torchBtn.textContent = "ライト起動 / Torch";
    }
  }
  async function toggleTorch() {
    if (!scanning || !torchSupported) return;
    const nextState = !torchOn;
    let applied = false;
    const track = getVideoTrack();
    if (track && typeof track.applyConstraints === "function") {
      try {
        await track.applyConstraints({ advanced: [{ torch: nextState }] });
        applied = true;
      } catch (err) {
        console.warn("Direct track torch applyConstraints failed:", err);
      }
    }
    if (!applied && html5QrCode && typeof html5QrCode.applyVideoConstraints === "function") {
      try {
        await html5QrCode.applyVideoConstraints({ advanced: [{ torch: nextState }] });
        applied = true;
      } catch (err) {
        console.warn("html5QrCode applyVideoConstraints failed:", err);
      }
    }
    if (applied) {
      torchOn = nextState;
      torchBtn.textContent = torchOn ? "ライトOFF / Torch off" : "ライトON / Torch on";
    } else {
      alert("ライトの切り替えに失敗しました / Failed to toggle torch");
    }
  }
  function resetCameraUI() {
    camToggleBtn.textContent = "カメラ起動 / Start camera";
    camToggleBtn.classList.remove("secondary");
    camToggleBtn.disabled = false;
    cameraSelect.disabled = false;
    torchBtn.style.display = "none";
    torchBtn.textContent = "ライト起動 / Torch";
    torchOn = false;
    torchSupported = false;
    cameraControls.classList.remove("active");
    cameraControls.classList.remove("has-torch");
    if (readerWrap) readerWrap.classList.remove("active", "scanned");
  }
  async function stopCamera(keepReaderActive = false) {
    scanning = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    videoEl = null;
    if (html5QrCode && html5QrCode.isScanning) {
      try {
        await html5QrCode.stop();
      } catch (err) {
        console.warn("stopCamera failed:", err);
      }
    }
    if (!keepReaderActive) {
      readerEl.classList.remove("active");
      if (readerWrap) readerWrap.classList.remove("active");
      resetCameraUI();
      lastShownFront = null;
      lastShownHidden = null;
      if (/探しています/.test(readStatus.textContent)) {
        setStatus("", "");
      }
    }
  }
  async function startCamera(specificDeviceId) {
    if (!html5QrCode) {
      setReadError("カメラ機能を読み込めませんでした / Could not load the camera library.");
      return;
    }
    if (scanning) return;
    setStatus("", "");
    readOut.classList.remove("visible");
    lastShownFront = null;
    lastShownHidden = null;
    readerEl.classList.add("active");
    if (readerWrap) readerWrap.classList.add("active");
    const targetDeviceId = specificDeviceId || cameraSelect.value;
    const cameraConfig = targetDeviceId ? targetDeviceId : { facingMode: "environment" };
    const scanConfig = {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const maxWidth = Math.max(50, viewfinderWidth - 20);
        const maxHeight = Math.max(50, viewfinderHeight - 20);
        const width = Math.min(maxWidth, Math.max(270, Math.floor(viewfinderWidth * 0.9)));
        const height = Math.min(maxHeight, Math.max(230, Math.floor(width * 0.82)));
        return { width, height };
      }
    };
    try {
      await html5QrCode.start(
        cameraConfig,
        scanConfig,
        (decodedText, decodedResult) => handleCameraHit(decodedText, decodedResult),
        () => { }
      );
    } catch (err) {
      let fallbackSuccess = false;
      if (targetDeviceId) {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            scanConfig,
            (decodedText, decodedResult) => handleCameraHit(decodedText, decodedResult),
            () => { }
          );
          fallbackSuccess = true;
        } catch (fbErr) {
          fallbackSuccess = false;
        }
      }
      if (!fallbackSuccess) {
        readerEl.classList.remove("active");
        if (readerWrap) readerWrap.classList.remove("active");
        resetCameraUI();
        setReadError("カメラを使えませんでした。ブラウザのカメラ権限を確認してください。 / Could not access the camera. Check the camera permission.");
        return;
      }
    }
    camToggleBtn.textContent = "カメラ停止 / Stop camera";
    camToggleBtn.classList.add("secondary");
    cameraControls.classList.add("active");
    videoEl = readerEl.querySelector("video");
    scanning = true;
    lastScan = 0;
    raf = requestAnimationFrame(scanFrame);
    checkTorchCapability();
    setTimeout(checkTorchCapability, 200);
    setTimeout(checkTorchCapability, 600);
    setTimeout(checkTorchCapability, 1200);
    if (videoEl) {
      videoEl.addEventListener("loadedmetadata", checkTorchCapability, { once: true });
      videoEl.addEventListener("play", checkTorchCapability, { once: true });
    }
    await listCameras(true);
  }
  function captureCurrentFrame() {
    if (!videoEl) videoEl = readerEl.querySelector("video");
    if (!videoEl || videoEl.readyState < 2) return null;
    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (!width || !height) return null;
    const scale = Math.min(1, MAX_SCAN_DIM / Math.max(width, height));
    workCanvas.width = Math.max(1, Math.round(width * scale));
    workCanvas.height = Math.max(1, Math.round(height * scale));
    const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(videoEl, 0, 0, workCanvas.width, workCanvas.height);
    return ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  }
  function safeDecodeImageData(imageData) {
    try {
      return decodeImageData(imageData);
    } catch (err) {
      return null;
    }
  }
  function decodeCurrentFrame(withVariants) {
    const imageData = captureCurrentFrame();
    if (!imageData) return null;
    const original = safeDecodeImageData(imageData);
    if (!withVariants) return original;
    if (original && original.info && original.info.ok && original.info.hidden !== null) {
      return original;
    }
    const binarized = safeDecodeImageData(binarizeImageData(imageData));
    if (binarized && binarized.info && binarized.info.ok && binarized.info.hidden !== null) {
      return binarized;
    }
    return original || binarized;
  }
  function applyCameraResult(result) {
    if (!scanning) return;
    const front = result.front || "";
    const hidden = result.info && result.info.ok && result.info.hidden !== null
      ? result.info.hidden
      : null;
    if (front === lastShownFront && hidden === lastShownHidden) return;
    lastShownFront = front;
    lastShownHidden = hidden;
    triggerScanBorder();
    showResult(result);
    if (hidden !== null) {
      setStatus("隠されたメッセージ... を読み取りました。 / Hidden message recovered.", "ok");
    } else if (result.format && result.format !== "QR_CODE") {
      setStatus(`バーコード (${result.format}) を読み取りました。 / Barcode scanned: ${front}`, "ok");
    } else {
      setStatus("内容は読めました。隠されたメッセージ... はありませんでした。 / Front content read. No hidden message was found.", "warn");
    }
  }
  function handleCameraHit(decodedText, decodedResult) {
    if (!scanning) return;
    const formatName = decodedResult && decodedResult.result && decodedResult.result.format
      ? decodedResult.result.format.formatName
      : null;
    const result = decodeCurrentFrame(true) || {
      front: decodedText,
      version: null,
      info: null,
      format: formatName
    };
    applyCameraResult(result);
  }
  function scanFrame(timestamp) {
    if (!scanning || isSwitchingCamera) return;
    raf = requestAnimationFrame(scanFrame);
    if (timestamp - lastScan < 200) return;
    lastScan = timestamp;
    const needVariants = lastShownFront !== null && lastShownHidden === null;
    const result = decodeCurrentFrame(needVariants);
    if (!result) {
      if (lastShownFront === null) {
        setStatus("QRコード / バーコードを探しています... / Looking for a QR code or barcode...", "");
      }
      return;
    }
    applyCameraResult(result);
  }
  camToggleBtn.addEventListener("click", () => {
    if (isSwitchingCamera) return;
    if (scanning) {
      stopCamera();
    } else {
      startCamera();
    }
  });
  cameraSelect.addEventListener("change", async () => {
    const selectedId = cameraSelect.value;
    if (!selectedId) return;
    if (scanning) {
      if (isSwitchingCamera) return;
      isSwitchingCamera = true;
      cameraSelect.disabled = true;
      camToggleBtn.disabled = true;
      torchBtn.style.display = "none";
      torchOn = false;
      torchBtn.textContent = "ライト起動 / Torch";
      cameraControls.classList.remove("has-torch");
      try {
        await stopCamera(true);
        await startCamera(selectedId);
      } catch (err) {
        console.error("Camera switch failed:", err);
      } finally {
        isSwitchingCamera = false;
        cameraSelect.disabled = false;
        camToggleBtn.disabled = false;
      }
    }
  });
  torchBtn.addEventListener("click", toggleTorch);
  resetBtn.addEventListener("click", () => {
    readOut.classList.remove("visible");
    setStatus("", "");
    lastShownFront = null;
    lastShownHidden = null;
  });
  (() => {
    const footer = $("footer-copy");
    if (!footer) return;
    const baseYear = 2025;
    const currentYear = new Date().getFullYear();
    const yearString = baseYear + (currentYear > baseYear ? "~" + currentYear : "");
    const hostname = location.hostname;
    let copyright = "";
    if (hostname === "hamuzon.github.io") {
      copyright = "&copy; " + yearString + ' <a href="https://hamuzon.github.io" target="_blank" rel="noopener noreferrer">@hamuzon</a>';
    } else if (hostname.includes("hamuzon-jp.f5.si")) {
      copyright = "&copy; " + yearString + ' <a href="https://hamuzon-jp.f5.si" target="_blank" rel="noopener noreferrer">@hamuzon</a>';
    } else if (hostname.includes("hamusata.f5.si")) {
      copyright = "&copy; " + yearString + ' <a href="https://hamusata.f5.si" target="_blank" rel="noopener noreferrer">@hamusata</a>';
    } else if (hostname.includes("qr.link-s.f5.si")) {
      copyright = "&copy; " + yearString + ' <a href="https://hamusata.f5.si" target="_blank" rel="noopener noreferrer">@hamusata</a>';
    } else {
      copyright = "&copy; " + yearString + " QR Code Steganography";
    }
    footer.innerHTML = [
      "<p>" + copyright + "</p>",
      '<p>このサービスは <a href="https://github.com/cozmo/jsQR" target="_blank" rel="noopener noreferrer">jsQR</a> と <a href="https://github.com/mebjas/html5-qrcode" target="_blank" rel="noopener noreferrer">html5-qrcode</a> のライブラリを使用しています。<br>This service uses the jsQR and html5-qrcode libraries.</p>',
      '<p class="trademark">※QRコードは（株）デンソーウェーブの登録商標です。<br>"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.</p>'
    ].join("");
  })();
})();
