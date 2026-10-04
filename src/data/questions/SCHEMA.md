# Question bank format

One JSON file per country: `src/data/questions/<countryId>.json`

```json
{
  "country": "egypt",
  "topics": {
    "history":         [ /* exactly 10 questions */ ],
    "technology":      [ /* 10 */ ],
    "art":             [ /* 10 */ ],
    "politics":        [ /* 10 */ ],
    "current-affairs": [ /* 10 */ ],
    "general":         [ /* 10 */ ]
  }
}
```

Each question:

```json
{
  "q": "Which pharaoh commissioned the Great Pyramid of Giza?",
  "choices": ["Khufu", "Ramesses II", "Tutankhamun", "Akhenaten"],
  "answer": 0,
  "fact": "The Great Pyramid (c. 2560 BCE) was built for Khufu and was the tallest human-made structure for over 3,800 years.",
  "difficulty": 1,
  "asOf": "2025"
}
```

- `choices`: exactly 4 strings, one correct. Choices are shuffled at runtime, so order does not matter.
- `answer`: index (0-3) of the correct choice in `choices`.
- `fact`: 1-2 sentence "postcard" fact shown after answering. Keep it under ~220 characters.
- `difficulty`: 1 (easy), 2 (medium), 3 (hard).
- `asOf`: required for `current-affairs`, omitted elsewhere. The year the fact was true.

A quiz is 10 questions; the player needs 90% (9/10) to unlock the next country.
