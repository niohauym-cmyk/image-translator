const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static("public"));

function splitLongText(text, maxLen = 430) {
  const clean = String(text || "").trim();

  if (!clean) {
    return [];
  }

  const words = clean.split(/\s+/);
  const parts = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;

    if (test.length <= maxLen) {
      current = test;
    } else {
      if (current) {
        parts.push(current);
      }

      if (word.length > maxLen) {
        for (let i = 0; i < word.length; i += maxLen) {
          parts.push(word.slice(i, i + maxLen));
        }
        current = "";
      } else {
        current = word;
      }
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

async function translateLibreTranslate(text, source, target) {
  const response = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: text,
      source: source,
      target: target,
      format: "text"
    })
  });

  if (!response.ok) {
    throw new Error("LibreTranslate failed");
  }

  const data = await response.json();

  if (data && typeof data.translatedText === "string") {
    return data.translatedText;
  }

  throw new Error("LibreTranslate invalid response");
}

async function translateMyMemory(text, source, target) {
  const langpair = source + "|" + target;

  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) +
    "&langpair=" +
    encodeURIComponent(langpair);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("MyMemory failed");
  }

  const data = await response.json();

  if (
    data &&
    data.responseData &&
    typeof data.responseData.translatedText === "string"
  ) {
    return data.responseData.translatedText;
  }

  throw new Error("MyMemory invalid response");
}

async function smartTranslate(text, source, target) {
  const parts = splitLongText(text, 430);
  const translatedParts = [];

  for (const part of parts) {
    let translated = part;

    try {
      translated = await translateLibreTranslate(part, source, target);
    } catch (error1) {
      try {
        translated = await translateMyMemory(part, source, target);
      } catch (error2) {
        translated = part;
      }
    }

    translatedParts.push(translated);
  }

  return translatedParts.join(" ");
}

app.post("/api/translate", async function(req, res) {
  try {
    const body = req.body || {};
    const text = body.text;
    const source = body.source || "en";
    const target = body.target || "ar";

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "No text provided"
      });
    }

    const translatedText = await smartTranslate(String(text), source, target);

    res.json({
      translatedText: translatedText
    });
  } catch (error) {
    console.error("Translation error:", error.message);

    res.status(500).json({
      error: "Translation failed"
    });
  }
});

app.get("/health", function(req, res) {
  res.send("OK");
});

app.listen(PORT, function() {
  console.log("Server running on http://localhost:" + PORT);
});
