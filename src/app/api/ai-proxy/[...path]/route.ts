import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

function getAiServiceConfig() {
  const url = process.env.AI_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
  const configured = process.env.AI_SERVICE_SECRET?.trim();
  const secret =
    configured && configured !== "replace-with-shared-ai-service-secret"
      ? configured
      : "hershield-local-ai-secret";
  return { url, secret };
}

// PrivacyShield gate: Volunteers are ONLY allowed to access sanitized preview routes
function isVolunteerAllowedPath(subPath: string): boolean {
  return subPath.startsWith("privacy/preview/");
}

async function handleProxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { path } = await params;
  const subPath = path.join("/");

  if (user.role === "volunteer" && !isVolunteerAllowedPath(subPath)) {
    return NextResponse.json(
      {
        error:
          "PrivacyShield policy: Volunteers cannot access raw camera feeds or operator AI endpoints.",
      },
      { status: 403 }
    );
  }

  const { url, secret } = getAiServiceConfig();
  const reqUrl = new URL(request.url);
  const targetUrl = `${url}/${subPath}${reqUrl.search}`;

  const headers = new Headers();
  headers.set("x-hershield-ai-secret", secret);
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  try {
    const isBodyMethod =
      request.method !== "GET" && request.method !== "HEAD";

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: isBodyMethod ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: request.signal,
    });

    const resHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) resHeaders.set("content-type", upstreamType);
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) resHeaders.set("cache-control", cacheControl);
    resHeaders.set("X-Accel-Buffering", "no");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Local AI service is offline or unreachable. Start the Python FastAPI AI backend on your laptop.",
        details: err instanceof Error ? err.message : "Connection refused",
      },
      { status: 503 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
