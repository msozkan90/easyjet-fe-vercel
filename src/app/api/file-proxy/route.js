export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = new Set([
  'easyjetconnect.s3.eu-central-1.amazonaws.com',
  'api.shipstation.com',
  'api.shipengine.com',
  'easypost-files.s3.us-west-2.amazonaws.com',
]);

// Shared hosts are only allowed for specific buckets (path prefixes), e.g. Rexven designs/mockups.
const ALLOWED_HOST_PATH_PREFIXES = new Map([
  [
    'storage.googleapis.com',
    ['/rexven-storage-public/', '/rexven-cloudinary-backup/', '/rexven-pdfs/'],
  ],
]);

const isAllowedTarget = (url) => {
  if (ALLOWED_HOSTS.has(url.hostname)) return true;
  const prefixes = ALLOWED_HOST_PATH_PREFIXES.get(url.hostname);
  return Boolean(prefixes?.some((prefix) => url.pathname.startsWith(prefix)));
};

const getErrorResponse = (message, status = 400) =>
  Response.json({ success: false, message }, { status });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  const forceDownload = searchParams.get('download') === '1';

  if (!target) {
    return getErrorResponse("Missing 'url' query parameter.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(target);
  } catch {
    return getErrorResponse("Invalid 'url' query parameter.");
  }

  if (parsedUrl.protocol !== 'https:') {
    return getErrorResponse('Only https URLs are allowed.');
  }

  if (!isAllowedTarget(parsedUrl)) {
    return getErrorResponse('Host is not allowed.');
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      return getErrorResponse(
        `Upstream download failed with status ${upstreamResponse.status}.`,
        upstreamResponse.status,
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = upstreamResponse.headers.get('content-disposition');
    const headers = new Headers({
      'content-type': contentType,
      'cache-control': 'no-store',
    });

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) headers.set('content-length', contentLength);

    if (forceDownload) {
      const pathname = decodeURIComponent(parsedUrl.pathname || '');
      const rawFilename = pathname.split('/').filter(Boolean).pop() || 'design';
      const safeFilename = rawFilename.replace(/[\\/:*?"<>|\r\n]/g, '_');
      headers.set(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
      );
    } else if (contentDisposition) {
      headers.set('content-disposition', contentDisposition);
    }

    return new Response(upstreamResponse.body, {
      status: 200,
      headers,
    });
  } catch {
    return getErrorResponse('Download request failed.', 502);
  }
}
