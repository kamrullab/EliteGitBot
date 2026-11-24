import { pbkdf2Sync, randomBytes } from "node:crypto";
const password = process.argv[2];
if (!password || password.length < 12) { console.error("Usage: node scripts/hash-password.mjs <password of at least 12 characters>"); process.exit(1); }
// Cloudflare Workers Web Crypto currently caps PBKDF2 at 100,000 iterations.
const iterations = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(`pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`);
