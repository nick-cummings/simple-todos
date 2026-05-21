// One-shot helper to mint a VAPID keypair for Web Push.
// Run with: node scripts/generate-vapid-keys.mjs
//
// Output: prints the public + private keys. Stash them in your
// Terraform tfvars (or Vercel env vars directly) under
// NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. The public
// key is shipped to the client; the private key never leaves
// the server.
//
// Re-running this rotates the keys, which invalidates every
// existing PushSubscription on every device. Don't rotate
// casually.

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log();
console.log(
  "Also set CRON_SECRET to a random 32+ char string used to auth /api/push/notify-cron.",
);
