/**
 * QR Code Generator API — Cloudflare Pages Function
 *
 * Endpoints:
 *   /api/QR           QRコード画像を生成 (PNG/SVG)
 *   /api/QR/help      ヘルプ (JSON)
 *   /api/QR/info      テキストの容量・バージョン情報 (JSON)
 *
 * Query Parameters (共通):
 *   t      : QRコードに埋め込むテキスト (必須 ※ url/text/data でも可)
 *   url    : QRコードに埋め込むURL (t の代わりに使用可)
 *   text   : QRコードに埋め込むテキスト (t の代わりに使用可)
 *   data   : QRコードに埋め込むデータ (t の代わりに使用可)
 *   mode   : "text" (デフォルト) | "wifi" | "email"
 *   v      : QRコードバージョン 1〜40 (省略時は自動)
 *   s      : 画像サイズ px (省略時は 256)
 *   fmt    : 出力形式 "png" | "svg" (省略時は png)
 *   ec     : 誤り訂正レベル "L" | "M" | "Q" | "H" (省略時は M)
 *   color  : 前景色 (hex: "000000" 等、省略時は黒)
 *   bg     : 背景色 (hex: "ffffff" 等、省略時は白)
 *   margin : 余白モジュール数 0〜10 (省略時は 4)
 *   dl     : ファイルダウンロード名 (指定時は Content-Disposition 付与)
 *
 * Wi-Fi モード (mode=wifi):
 *   ssid     : ネットワーク名 (必須)
 *   security : "WPA" | "WEP" | "nopass" (省略時は WPA)
 *   password : パスワード (nopass の場合は省略可)
 *   hidden   : "true" で隠しネットワーク
 *
 * Email モード (mode=email):
 *   to      : 宛先メールアドレス (必須)
 *   subject : 件名 (省略可)
 *   body    : 本文 (省略可)
 */

import { EC_LEVEL, VERSION_TABLE }   from "./_qr/tables.js"
import { generateQR, selectVersion } from "./_qr/generate.js"
import { getModuleCount }            from "./_qr/matrix.js"
import { qrToSVG, qrToPNG }         from "./_qr/output.js"
import { buildWifiString }           from "./_qr/wifi.js"
import { buildEmailString }          from "./_qr/email.js"


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}


// ──────────────────────────────────────────
//  Entry Point
// ──────────────────────────────────────────

/** Cloudflare Pages Function Entry Point */
export async function onRequest(context) {
  return handleRequest(context.request)
}


async function handleRequest(request) {

  if (request.method === "OPTIONS") {
    return new Response(
      null,
      {
        status: 204,
        headers: CORS_HEADERS,
      }
    )
  }


  const url = new URL(request.url)
  const path = url.pathname.replace(/\.js$/, "").replace(/\/$/, "")


  // ────────────────────────
  //  ヘルプ
  // ────────────────────────

  if (path === "/api/QR/help") {
    return handleHelp()
  }


  // ────────────────────────
  //  情報
  // ────────────────────────

  if (path === "/api/QR/info") {
    return handleInfo(url.searchParams)
  }


  // ────────────────────────
  //  QRコード生成
  // ────────────────────────

  if (path === "/api/QR") {
    return handleGenerate(url.searchParams)
  }


  // ────────────────────────
  //  404
  // ────────────────────────

  return jsonResponse(
    {
      api: "📱 QRコード生成API 📱",
      description: "テキストやURLからQRコード画像を生成するAPIです。",

      usage: {
        endpoint: "/api/QR",
        example: "/api/QR?t=Hello",
        help: "/api/QR/help",
        info: "/api/QR/info?t=Hello",
      },
    },
    404
  )

}


// ══════════════════════════════════════════
//  Route Handlers
// ══════════════════════════════════════════


// ── /api/QR/help ──

function handleHelp() {

  return jsonResponse({
    name: "QRコード生成API ヘルプ",
    endpoint: "/api/QR",
    description: "テキスト・Wi-Fi・メールからQRコード画像を生成して返します。",

    parameters: {
      t:        "QRコードに埋め込むテキスト（必須 ※ url, text, data でも可）",
      url:      "QRコードに埋め込むURL（t の代わりに使用可）",
      text:     "QRコードに埋め込むテキスト（t の代わりに使用可）",
      data:     "QRコードに埋め込むデータ（t の代わりに使用可）",
      mode:     "text | wifi | email：QRモード（省略時はtext）",
      v:        "1〜40：QRバージョン（省略時は自動選択）",
      s:        "64〜2048：画像サイズ px（省略時は256）",
      fmt:      "png | svg：出力形式（省略時はpng）",
      ec:       "L | M | Q | H：誤り訂正レベル（省略時はM）",
      color:    "前景色（6桁hex, 例: 000000 = 黒）省略時は黒",
      bg:       "背景色（6桁hex, 例: ffffff = 白）省略時は白",
      margin:   "0〜10：余白モジュール数（省略時は4）",
      dl:       "ファイル名を指定するとダウンロード用ヘッダーを付与",
    },

    wifi_parameters: {
      ssid:     "Wi-Fiネットワーク名（mode=wifi 時必須）",
      security: "WPA | WEP | nopass（省略時はWPA）",
      password: "Wi-Fiパスワード（nopass の場合は省略可）",
      hidden:   "true で隠しネットワーク（省略時はfalse）",
    },

    email_parameters: {
      to:      "宛先メールアドレス（mode=email 時必須）",
      subject: "件名（省略可）",
      body:    "本文（省略可）",
    },

    priority: "パラメータの優先順位: t > url > text > data",

    examples: [
      "/api/QR?t=Hello",
      "/api/QR?url=https://example.com&s=512&ec=H",
      "/api/QR?text=こんにちは&fmt=svg",
      "/api/QR?t=Hello&color=ff0000&bg=ffffcc",
      "/api/QR?mode=wifi&ssid=MyNetwork&password=secret123&security=WPA",
      "/api/QR?mode=email&to=hello@example.com&subject=Hello&body=Hi+there",
      "/api/QR?t=Hello&dl=my_qr",
    ],

    related_endpoints: {
      info: "/api/QR/info?t=<text>  テキストの容量・バージョン情報を返す",
      help: "/api/QR/help           このヘルプを表示",
    },
  })

}


// ── /api/QR/info ──

function handleInfo(params) {

  const text = getTextParam(params)

  if (!text) {
    return jsonResponse(
      {
        error: "テキストパラメータが必要です。t, url, text, data のいずれかを指定してください。",
        usage: "/api/QR/info?t=YourTextHere",
      },
      400
    )
  }

  const ecLevel = parseEcLevel(params)
  const utf8Bytes = new TextEncoder().encode(text)

  try {

    const version = selectVersion(text, ecLevel)
    const vInfo = VERSION_TABLE[version][EC_LEVEL[ecLevel]]
    const ccBits = version <= 9 ? 8 : 16
    const usedBits = 4 + ccBits + utf8Bytes.length * 8
    const totalBits = vInfo.totalDataCodewords * 8

    return jsonResponse({

      input: {
        text: text,
        byte_length: utf8Bytes.length,
        ec_level: ecLevel,
      },

      qr_info: {
        version: version,
        module_count: getModuleCount(version),
        total_data_bits: totalBits,
        used_data_bits: usedBits,
        remaining_bits: totalBits - usedBits,
        usage_percent: Number(((usedBits / totalBits) * 100).toFixed(2)),
        ec_codewords_per_block: vInfo.ecPerBlock,
        block_groups: vInfo.groups,
      },

      capacity_by_ec: buildCapacityByEc(text),

      generate_url: `/api/QR?t=${encodeURIComponent(text)}&ec=${ecLevel}`,

    })

  } catch (e) {

    return jsonResponse(
      {
        error: "QR情報の取得に失敗しました。",
        detail: e.message,
      },
      400
    )

  }

}


// ── /api/QR (メイン生成) ──

function handleGenerate(params) {

  // モードに応じてQRデータ文字列を決定
  const mode = (params.get("mode") || "text").toLowerCase()
  let text

  if (mode === "wifi") {
    const result = buildWifiString(params)
    if (result.error) {
      return jsonResponse({ error: result.error, help: "/api/QR/help" }, 400)
    }
    text = result.text

  } else if (mode === "email") {
    const result = buildEmailString(params)
    if (result.error) {
      return jsonResponse({ error: result.error, help: "/api/QR/help" }, 400)
    }
    text = result.text

  } else {
    text = getTextParam(params)
    if (!text) {
      return jsonResponse(
        {
          error: "テキストパラメータが必要です。t, url, text, data のいずれかを指定してください。",
          usage: "/api/QR?t=YourTextHere または /api/QR?url=https://example.com",
          help: "/api/QR/help",
        },
        400
      )
    }
  }


  // パラメータ解析
  const ecLevel = parseEcLevel(params)
  const fmt     = (params.get("fmt") || "png").toLowerCase()

  let size = parseInt(params.get("s")) || 256
  size = Math.min(Math.max(size, 64), 2048)

  let version = params.get("v") ? parseInt(params.get("v")) : 0
  if (version) {
    version = Math.min(Math.max(version, 1), 40)
  }

  const fgColor = parseHexColor(params.get("color")) || { r: 0, g: 0, b: 0 }
  const bgColor = parseHexColor(params.get("bg"))    || { r: 255, g: 255, b: 255 }

  let margin = parseInt(params.get("margin"))
  if (isNaN(margin)) margin = 4
  margin = Math.min(Math.max(margin, 0), 10)

  const dlName = params.get("dl") || ""


  try {

    const qr = generateQR(text, ecLevel, version)

    // 共通ヘッダー
    const baseHeaders = {
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    }

    // ダウンロード用ヘッダー
    if (dlName) {
      const ext = fmt === "svg" ? "svg" : "png"
      baseHeaders["Content-Disposition"] = `attachment; filename="${sanitizeFilename(dlName)}.${ext}"`
    }


    // SVG 出力
    if (fmt === "svg") {

      const svg = qrToSVG(qr, size, fgColor, bgColor, margin)

      return new Response(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          ...baseHeaders,
        },
      })

    }


    // PNG 出力（デフォルト）
    const png = qrToPNG(qr, size, fgColor, bgColor, margin)

    return new Response(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        ...baseHeaders,
      },
    })

  } catch (e) {

    return jsonResponse(
      {
        error: "QRコードの生成に失敗しました。",
        detail: e.message,
        help: "/api/QR/help",
      },
      400
    )

  }

}


// ══════════════════════════════════════════
//  Shared Helpers
// ══════════════════════════════════════════


/**
 * t > url > text > data の優先順でテキストパラメータを取得
 */
function getTextParam(params) {
  return params.get("t") || params.get("url") || params.get("text") || params.get("data")
}


// buildWifiString → ./_qr/wifi.js
// buildEmailString → ./_qr/email.js


/**
 * ec パラメータを正規化 (L/M/Q/H)
 */
function parseEcLevel(params) {

  const raw = (params.get("ec") || "M").toUpperCase()
  return ["L", "M", "Q", "H"].includes(raw) ? raw : "M"

}


/**
 * 6桁HEXカラー文字列を { r, g, b } に変換
 * 無効値は null を返す
 */
function parseHexColor(hex) {

  if (!hex) return null

  // # プレフィックスを除去
  hex = hex.replace(/^#/, "")

  // 3桁表記を6桁に展開 (abc → aabbcc)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  }

}


/**
 * ファイル名のサニタイズ
 */
function sanitizeFilename(name) {

  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, "_")
    .substring(0, 64)

}


/**
 * 各ECレベルでの容量情報を構築
 */
function buildCapacityByEc(text) {

  const result = {}

  for (const ec of ["L", "M", "Q", "H"]) {
    try {
      const v = selectVersion(text, ec)
      result[ec] = {
        version: v,
        max_bytes: VERSION_TABLE[v][EC_LEVEL[ec]].totalDataCodewords,
      }
    } catch {
      result[ec] = { version: null, max_bytes: null }
    }
  }

  return result

}


// ──────────────────────────────────────────
//  JSON Response
// ──────────────────────────────────────────

function jsonResponse(data, status = 200) {

  const now = new Date()

  return new Response(
    JSON.stringify(
      {
        ...data,
        timestamp_utc:  now.toISOString(),
        timestamp_jst:  now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
        timestamp_unix: now.getTime(),
      },
      null,
      2
    ),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
      },
    }
  )

}
