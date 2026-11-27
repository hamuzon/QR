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
          } catch (err) {}
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
          } catch (err) {}
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
      } catch (err) {}

      const fileInput = $("fileInput");
      const dropZone = $("dropZone");
      const cameraSelect = $("cameraSelect");
      const camStart = $("camStart");
      const camStop = $("camStop");
      const torchBtn = $("torchBtn");
      const video = $("video");
      const readStatus = $("readStatus");
      const readOut = $("readOut");
      const outFront = $("outFront");
      const outHidden = $("outHidden");
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
        } else {
          outHidden.textContent = "なし / None";
          outHidden.classList.add("muted");
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

        return (x, y) => {
          const u = (x + 0.5) / n;
          const v = (y + 0.5) / n;
          const px = TL.x * (1 - u) * (1 - v) + TR.x * u * (1 - v) + BL.x * (1 - u) * v + BR.x * u * v;
          const py = TL.y * (1 - u) * (1 - v) + TR.y * u * (1 - v) + BL.y * (1 - u) * v + BR.y * u * v;
          return grayAt(px, py) < 128 ? 1 : 0;
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
          try {
            info = QRSteg.readMatrix(sample, version);
          } catch (err) {
            info = null;
          }
          if (!info || !info.ok) {
            try {
              const transposed = QRSteg.readMatrix((x, y) => sample(y, x), version);
              if (transposed && transposed.ok) info = transposed;
            } catch (err) {
              info = null;
            }
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

      function scanImageElement(img) {
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
          setStatus("隠されたメッセージ... は見つかりませんでした / No hidden message was found.", "warn");
          return;
        }

        setReadError("QRコードが見つかりませんでした / No QR code was found.");
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
          scanImageElement(img);
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
          scanImageElement(img);
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

      let stream = null;
      let raf = null;
      let scanning = false;
      let lastScan = 0;
      let torchOn = false;
      let torchSupported = false;
      const workCanvas = document.createElement("canvas");

      async function listCameras() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter((device) => device.kind === "videoinput");
          const current = cameraSelect.value;
          cameraSelect.innerHTML = "";

          if (!cameras.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "カメラが見つかりません / No camera found";
            cameraSelect.appendChild(option);
            return;
          }

          cameras.forEach((camera, index) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.textContent = camera.label || "カメラ " + (index + 1);
            cameraSelect.appendChild(option);
          });

          if (current && cameras.some((camera) => camera.deviceId === current)) {
            cameraSelect.value = current;
          } else {
            const back = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
            if (back) cameraSelect.value = back.deviceId;
          }
        } catch (err) {
          return;
        }
      }

      listCameras();

      function stopCamera() {
        scanning = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
        }
        video.srcObject = null;
        video.style.display = "none";
        camStart.style.display = "inline-block";
        camStop.style.display = "none";
        torchBtn.style.display = "none";
        torchOn = false;
        torchSupported = false;

        if (readStatus.textContent === "QRコードを探しています... / Looking for a QR code...") {
          setStatus("", "");
        }
      }

      async function startCamera() {
        if (scanning) return;
        setStatus("", "");
        readOut.classList.remove("visible");

        const deviceId = cameraSelect.value;
        const constraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "environment" }
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          setReadError("カメラを使えませんでした。ブラウザのカメラ権限を確認してください。 / Could not access the camera. Check the camera permission.");
          return;
        }

        video.srcObject = stream;
        video.style.display = "block";
        await video.play();

        camStart.style.display = "none";
        camStop.style.display = "inline-block";

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        torchSupported = !!capabilities.torch;
        torchBtn.style.display = torchSupported ? "inline-block" : "none";

        scanning = true;
        lastScan = 0;
        raf = requestAnimationFrame(scanFrame);

        await listCameras();
      }

      function scanFrame(timestamp) {
        if (!scanning) return;
        raf = requestAnimationFrame(scanFrame);
        if (timestamp - lastScan < 200 || video.readyState < 2) return;
        lastScan = timestamp;

        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;

        const scale = Math.min(1, MAX_SCAN_DIM / Math.max(width, height));
        workCanvas.width = Math.max(1, Math.round(width * scale));
        workCanvas.height = Math.max(1, Math.round(height * scale));
        const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, workCanvas.width, workCanvas.height);
        const imageData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);

        let result = null;
        try {
          result = decodeImageData(imageData);
        } catch (err) {
          result = null;
        }

        if (!result) {
          setStatus("QRコードを探しています... / Looking for a QR code...", "");
          return;
        }

        showResult(result);

        if (result.info && result.info.ok && result.info.hidden !== null) {
          setStatus("隠されたメッセージ... を読み取りました。 / Hidden message recovered.", "ok");
        } else {
          setStatus("内容は読めました。隠されたメッセージ... は見つかりませんでした。 / Front content read. No hidden message was found.", "warn");
        }
        stopCamera();
      }

      camStart.addEventListener("click", startCamera);
      camStop.addEventListener("click", stopCamera);
      cameraSelect.addEventListener("change", () => {
        if (scanning) {
          stopCamera();
          startCamera();
        }
      });

      torchBtn.addEventListener("click", async () => {
        if (!stream || !torchSupported) return;
        const track = stream.getVideoTracks()[0];
        try {
          torchOn = !torchOn;
          await track.applyConstraints({ advanced: [{ torch: torchOn }] });
          torchBtn.textContent = torchOn ? "ライトOFF / Torch off" : "ライト / Torch";
        } catch (err) {
          return;
        }
      });

      resetBtn.addEventListener("click", () => {
        readOut.classList.remove("visible");
        setStatus("", "");
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
          '<p>QRコードの読み取りには <a href="https://github.com/cozmo/jsQR" target="_blank" rel="noopener noreferrer">jsQR</a> を使用しています。<br>QR decoding uses jsQR.</p>',
          '<p class="trademark">※QRコードは（株）デンソーウェーブの登録商標です。<br>"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.</p>'
        ].join("");
      })();
    })();
