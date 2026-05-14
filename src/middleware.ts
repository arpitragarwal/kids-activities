import { NextResponse, type NextRequest } from "next/server";

const SID_COOKIE = "sid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  if (req.cookies.get(SID_COOKIE)) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.cookies.set(SID_COOKIE, crypto.randomUUID(), {
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    path: "/",
  });
  return res;
}

// Skip Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
