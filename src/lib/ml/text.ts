export const MAX_TOKENS = 16;
export const VOCAB_SIZE = 384;

const FRUIT_ALIAS: Record<string, string> = {
  a: "fruita",
  ab: "fruitab",
  g: "fruitg",
  gb: "fruitgb",
  s: "fruits",
  sb: "fruitsb",
  p: "fruitp",
  pb: "fruitpb",
  c: "fruitc",
  cb: "fruitcb",
};

const WORDS = [
  "fruita",
  "fruitab",
  "fruitg",
  "fruitgb",
  "fruits",
  "fruitsb",
  "fruitp",
  "fruitpb",
  "fruitc",
  "fruitcb",
  "een",
  "a",
  "the",
  "de",
  "het",
  "op",
  "on",
  "met",
  "with",
  "rode",
  "red",
  "blauwe",
  "blue",
  "gele",
  "yellow",
  "groene",
  "green",
  "witte",
  "white",
  "zwarte",
  "black",
  "oranje",
  "orange",
  "cirkel",
  "circle",
  "vierkant",
  "square",
  "driehoek",
  "triangle",
  "ster",
  "star",
  "hart",
  "heart",
  "lichte",
  "light",
  "donkere",
  "dark",
  "achtergrond",
  "background",
  "groot",
  "big",
  "klein",
  "small",
  "rood",
  "blauw",
  "geel",
  "groen",
  "wit",
  "zwart",
  "hond",
  "honden",
  "hondje",
  "dog",
  "puppy",
  "kat",
  "katten",
  "poes",
  "cat",
  "kitten",
  "huisdier",
  "dier",
  "foto",
  "portret",
  "golden",
  "retriever",
  "labrador",
  "herder",
  "poedel",
  "terrier",
  "beagle",
  "husky",
  "chihuahua",
  "boxer",
  "teckel",
  "spaniel",
  "cocker",
  "bulldog",
  "poodle",
  "shepherd",
  "siamees",
  "pers",
  "bengaal",
  "ragdoll",
  "maine",
  "coon",
  "brits",
  "langhaar",
  "korthaar",
  "bruin",
  "grijs",
  "gevlekt",
  "liggen",
  "zitten",
  "staan",
  "buiten",
  "binnen",
  "gras",
  "sneeuw",
  "speels",
  "jong",
  "closeup",
  "tabby",
  "calico",
  "man",
  "woman",
  "person",
  "face",
  "portrait",
  "beard",
  "mustache",
  "glasses",
  "hair",
  "curly",
  "wavy",
  "bald",
  "older",
  "young",
  "asian",
  "latin",
  "blond",
  "gray",
  "bangs",
  "braids",
  "locs",
  "goatee",
  "freckles",
  "bob",
  "afro",
  "short",
  "long",
  "heritage",
  "mixed",
];

const WORD_ID = new Map(WORDS.map((w, i) => [w, i + 1]));
const HASH_BASE = WORDS.length + 2;
const HASH_SPAN = VOCAB_SIZE - HASH_BASE;

function hashToken(word: string): number {
  let h = 2166136261;
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return HASH_BASE + ((h >>> 0) % HASH_SPAN);
}

export function tokenize(text: string, maxLen = MAX_TOKENS): Int32Array {
  const trimmed = text.trim();
  const alias = FRUIT_ALIAS[trimmed.toLowerCase()];
  const source =
    alias && /^[A-Za-z]{1,3}$/.test(trimmed) ? alias : text;
  const norm = source
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const words = norm.split(/\s+/).filter(Boolean);
  const ids = new Int32Array(maxLen);
  for (let i = 0; i < Math.min(words.length, maxLen); i++) {
    const w = words[i]!;
    ids[i] = WORD_ID.get(w) ?? hashToken(w);
  }
  return ids;
}

/** Multi-hot bag-of-words. Padding is ignored, so captions don't collapse to the pad token. */
export function bagOfWords(text: string): Float32Array {
  const ids = tokenize(text);
  const v = new Float32Array(VOCAB_SIZE);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    if (id > 0 && id <= VOCAB_SIZE) v[id - 1] = 1;
  }
  return v;
}
