import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function asset(path) {
  return readFile(new URL(path, root), "utf8");
}

test("catalog assets no longer contain the blocking brand intro", async () => {
  const [storeScript, storeTemplate, styles] = await Promise.all([
    asset("public/assets/js/store.js"),
    asset("public/store.html"),
    asset("public/assets/css/styles.css")
  ]);

  assert.doesNotMatch(storeScript, /setupBrandIntro|bookloft_intro_seen|waitForIntroFont/);
  assert.doesNotMatch(storeTemplate, /brand-intro|Wejdź do przestrzeni pełnej książek/);
  assert.doesNotMatch(styles, /\.brand-intro|brandIntroEnter/);
});

test("page reveal respects motion preferences and touch targets stay accessible", async () => {
  const [productScript, styles] = await Promise.all([
    asset("public/assets/js/product.js"),
    asset("public/assets/css/styles.css")
  ]);

  assert.match(styles, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(styles, /animation: pageHeroReveal 520ms/);
  assert.match(styles, /\.popular-category-links a \{[\s\S]*?min-height: 44px/);
  assert.match(styles, /\.search-clear \{[\s\S]*?width: 44px;[\s\S]*?height: 44px/);
  assert.match(styles, /\.cookie-consent-actions button \{\s*min-height: 44px/);
  assert.match(productScript, /class="lightbox-arrow lightbox-arrow-prev"[^\n]+galleryArrowIcon\("previous"\)/);
});
