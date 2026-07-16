import assert from "node:assert/strict";
import test from "node:test";
import { catalogSearchScore, normalizeCatalogSearch } from "../src/lib/catalogSearch.js";

test("catalog search normalizes Polish characters and punctuation", () => {
  assert.equal(normalizeCatalogSearch("  Ziemiański / Achaja  "), "ziemianski achaja");
  assert.ok(catalogSearchScore("Achaja / Andrzej Ziemiański", "ziemianski achaja") >= 0);
});

test("catalog search tolerates one typo or adjacent transposition", () => {
  assert.ok(catalogSearchScore("Harry Potter i Kamień Filozoficzny", "harry poter") >= 0);
  assert.ok(catalogSearchScore("Harry Potter i Kamień Filozoficzny", "pottre") >= 0);
  assert.equal(catalogSearchScore("Harry Potter i Kamień Filozoficzny", "harry power"), -1);
});

test("exact catalog matches rank above fuzzy matches", () => {
  const exact = catalogSearchScore("Harry Potter i Kamień Filozoficzny", "harry potter");
  const fuzzy = catalogSearchScore("Harry Potter i Kamień Filozoficzny", "harry poter");
  assert.ok(exact > fuzzy);
});

test("punctuation-only queries do not match the whole catalog", () => {
  assert.equal(catalogSearchScore("Harry Potter", "---"), -1);
});
