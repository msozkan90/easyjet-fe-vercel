const ALLOWED_HOSTS = new Set(["i.etsystatic.com"]);
const REQUEST_TIMEOUT_MS = 10_000;

const errorResponse = (message, status = 400) =>
  Response.json({ success: false, message }, { status });

export async function HEAD(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return errorResponse("Missing 'url' query parameter.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(target);
  } catch {
    return errorResponse("Invalid 'url' query parameter.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    !ALLOWED_HOSTS.has(parsedUrl.hostname)
  ) {
    return errorResponse("Image host is not allowed.", 403);
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!upstreamResponse.ok) {
      return errorResponse(
        `Image metadata request failed with status ${upstreamResponse.status}.`,
        upstreamResponse.status,
      );
    }

    const contentLength = upstreamResponse.headers.get("content-length");
    const headers = new Headers({ "cache-control": "private, max-age=300" });
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new Response(null, { status: 200, headers });
  } catch {
    return errorResponse("Image metadata request failed.", 502);
  }
}
