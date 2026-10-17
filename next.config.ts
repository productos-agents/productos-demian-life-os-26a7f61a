import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ProductOS loads the development app through its external preview hostname.
  // This only affects dev-resource requests; application APIs remain protected by the session cookie.
  allowedDevOrigins: ["febfb04234c55d7b4be8698c9ba81719.preview.bl.run"],
};

export default nextConfig;
