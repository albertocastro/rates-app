"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "./ui/button";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Refi Radar
              </span>
            </Link>

            {user && (
              <div className="hidden md:flex ml-10 space-x-4">
                <Link
                  href="/status"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/status")
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/settings")
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  Settings
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center space-x-2">
                  {user.image && (
                    <img
                      src={user.image}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">{user.name || user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
