/**
 * QR Code — Email String Builder
 *
 * メール送信情報を QR コード用の文字列に変換する。
 *
 * 形式: mailto:<to>?subject=<subject>&body=<body>
 *
 * Export:
 *   buildEmailString(params) → { text } | { error }
 */


// ══════════════════════════════════════════
//  Email QR 文字列生成
// ══════════════════════════════════════════

/** メールアドレスの簡易検証パターン */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


/**
 * URLSearchParams から Email QR 文字列 (mailto URI) を生成する
 *
 * @param {URLSearchParams} params
 * @returns {{ text: string } | { error: string }}
 *
 * params:
 *   to      - 宛先メールアドレス (必須)
 *   subject - 件名 (省略可)
 *   body    - 本文 (省略可)
 */
export function buildEmailString(params) {

  const to      = params.get("to")      ?? ""
  const subject = params.get("subject") ?? ""
  const body    = params.get("body")    ?? ""

  // バリデーション
  if (!to) {
    return { error: "Email モードでは to パラメータが必要です。" }
  }

  if (!EMAIL_PATTERN.test(to)) {
    return { error: "to パラメータに有効なメールアドレスを指定してください。" }
  }

  // クエリパラメータ組み立て
  const query = []
  if (subject) query.push(`subject=${encodeURIComponent(subject)}`)
  if (body)    query.push(`body=${encodeURIComponent(body)}`)

  const text = query.length > 0
    ? `mailto:${to}?${query.join("&")}`
    : `mailto:${to}`

  return { text }

}
