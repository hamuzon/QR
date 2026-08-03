export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname.endsWith(".")) {
    url.hostname = url.hostname.slice(0, -1);
    return Response.redirect(url.toString(), 301);
  }

  let redirected = false;

  if (url.hostname === "hamuzon-jp.f5.si") {
    url.hostname = "qr.hamuzon-jp.f5.si";
    redirected = true;
  } else if (url.hostname === "hamusata.f5.si" || url.hostname === "qr.link-s.f5.si") {
    url.hostname = "qr.hamusata.f5.si";
    redirected = true;
  }

  if (redirected) {
    return Response.redirect(url.toString(), 301);
  }

  const response = await context.next();

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    let canonicalHost = "";
    if (url.hostname.includes("hamuzon-jp.f5.si") || url.hostname === "hamuzon.github.io") {
      canonicalHost = "qr.hamuzon-jp.f5.si";
    } else if (url.hostname.includes("hamusata.f5.si") || url.hostname === "qr.link-s.f5.si") {
      canonicalHost = "qr.hamusata.f5.si";
    }

    if (canonicalHost) {
      const canonicalUrl = `https://${canonicalHost}${url.pathname}`;
      return new HTMLRewriter()
        .on("head", {
          element(element) {
            element.append(`<link rel="canonical" href="${canonicalUrl}" />`, { html: true });
          },
        })
        .transform(response);
    }
  }

  return response;
}
