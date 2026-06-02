"use client";
import { useRouter } from "next/navigation";
import { TkxButton } from "@/components/tkx-dyn";

/**
 * Sign-out — POSTs to the native /api/auth/native/logout, which revokes the
 * Session row + clears the cookie, then router-pushes to /login.
 *
 * Mirrors the CSRF token from the cookie so the middleware accepts the POST.
 */
export function SignOutButton() {
  const router = useRouter();
  return (
    <TkxButton
      type="button"
      variant="ghost"
      colorScheme="secondary"
      size="sm"
      isFullWidth
      onClick={async () => {
        const csrf = readCookie("csrf_token");
        await fetch("/api/auth/native/logout", {
          method: "POST",
          headers: csrf ? { "x-csrf-token": csrf } : undefined,
        }).catch(() => {});
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </TkxButton>
  );
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]!) : null;
}
