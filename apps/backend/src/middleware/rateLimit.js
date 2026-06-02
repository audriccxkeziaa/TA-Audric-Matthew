// rateLimit.js — pembatas laju sederhana berbasis memori (tanpa dependency
// eksternal), cocok untuk satu instance (Railway). Dipakai membatasi brute-force
// pada endpoint sensitif seperti login. Kunci default = IP; bisa di-override
// (mis. IP + username) lewat keyGenerator.
const buckets = new Map(); // key → { count, resetAt }

function rateLimit({
  windowMs = 60 * 1000,
  max = 10,
  message = "Terlalu banyak percobaan, coba lagi nanti.",
  keyGenerator = (req) => req.ip || "unknown",
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || "unknown");
    let b = buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      res.set("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Pembersihan berkala agar Map tidak tumbuh tanpa batas.
const _sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}, 5 * 60 * 1000);
if (_sweep.unref) _sweep.unref();

module.exports = rateLimit;
