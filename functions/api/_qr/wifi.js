/**
 * QR Code — Wi-Fi String Builder
 *
 * Wi-Fi接続情報を QR コード用の文字列に変換する。
 *
 * 形式: WIFI:T:<security>;S:<ssid>;P:<password>;H:<hidden>;;
 *
 * Export:
 *   buildWifiString(params) → { text } | { error }
 */


// ══════════════════════════════════════════
//  Wi-Fi QR 文字列生成
// ══════════════════════════════════════════

/**
 * URLSearchParams から Wi-Fi QR 文字列を生成する
 *
 * @param {URLSearchParams} params
 * @returns {{ text: string } | { error: string }}
 *
 * params:
 *   ssid     - ネットワーク名 (必須)
 *   security - "WPA" | "WPA2" | "WPA3" | "WPA2_WPA3" | "WEP" | "EAP" | "WPA3_EAP" | "nopass" (省略時: WPA)
 *   password - nopass 以外は必須
 *   hidden   - "true" で隠しネットワーク
 */
export function buildWifiString(params) {

  const ssid     = params.get("ssid")     ?? ""
  const password = params.get("password") ?? ""
  const security = (params.get("security") ?? "WPA").toUpperCase()
  const hidden   = params.get("hidden") === "true"

  // バリデーション
  if (!ssid) {
    return { error: "Wi-Fi モードでは ssid パラメータが必要です。" }
  }

  const validSecurity = ["WPA", "WPA2", "WPA3", "WPA2_WPA3", "WEP", "NOPASS", "EAP", "WPA3_EAP"]
  const sec = validSecurity.includes(security) ? security : "WPA"

  if (sec !== "NOPASS" && !password) {
    return { error: `${sec} モードでは password パラメータが必要です。` }
  }

  // 特殊文字エスケープ: \  ;  ,  "  :
  const esc = (s) => s.replace(/[\\;,":]/g, (c) => `\\${c}`)

  const text = `WIFI:T:${sec};S:${esc(ssid)};P:${esc(password)};H:${hidden ? "true" : "false"};;`

  return { text }

}
