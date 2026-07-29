export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = new Set([
  "easyjetconnect.s3.eu-central-1.amazonaws.com",
  "api.shipstation.com",
  "easypost-files.s3.us-west-2.amazonaws.com",
]);

const getErrorResponse = (message, status = 400) =>
  Response.json({ success: false, message }, { status });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return getErrorResponse("Missing 'url' query parameter.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(target);
  } catch {
    return getErrorResponse("Invalid 'url' query parameter.");
  }

  if (parsedUrl.protocol !== "https:") {
    return getErrorResponse("Only https URLs are allowed.");
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return getErrorResponse("Host is not allowed.");
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return getErrorResponse(
        `Upstream download failed with status ${upstreamResponse.status}.`,
        upstreamResponse.status,
      );
    }

    const contentType =
      upstreamResponse.headers.get("content-type") ||
      "application/octet-stream";
    const contentDisposition = upstreamResponse.headers.get(
      "content-disposition",
    );
    const body = await upstreamResponse.arrayBuffer();

    const headers = new Headers({
      "content-type": contentType,
      "cache-control": "no-store",
      "content-length": String(body.byteLength),
    });

    if (contentDisposition) {
      headers.set("content-disposition", contentDisposition);
    }

    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return getErrorResponse(
      error instanceof Error ? error.message : "Download request failed.",
      502,
    );
  }
}
