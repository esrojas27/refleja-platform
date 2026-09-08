"use client";

import type { ReactNode } from "react";

import "aws-amplify/auth/enable-oauth-listener";

import { configureAmplify } from "@/lib/auth/amplify-configuration";

configureAmplify();

export function AmplifyAuthBootstrap({ children }: { children: ReactNode }) {
  return children;
}
