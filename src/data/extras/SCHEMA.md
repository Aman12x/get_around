# Extra round content

One JSON file per country: `src/data/extras/<countryId>.json`. These power the
non-multiple-choice rounds: timelines ("put these in order") and map pinpointing
("tap where X is").

```json
{
  "country": "egypt",
  "timeline": [
    { "event": "Construction of the Great Pyramid of Giza is completed", "year": -2560, "label": "c. 2560 BCE", "approx": true, "difficulty": 1 },
    { "event": "The Suez Canal opens", "year": 1869, "label": "1869", "difficulty": 1 }
  ],
  "places": [
    { "name": "Alexandria", "kind": "city", "lat": 31.20, "lon": 29.92, "clue": "Founded by Alexander the Great in 331 BCE.", "difficulty": 1 }
  ]
}
```

## timeline (at least 16 events)
- `event`: a short headline, under 80 characters, without the year in it.
- `year`: an integer, negative for BCE. Use the well-documented year.
- `label`: how the year is shown after answering, e.g. "1869" or "c. 2560 BCE".
- `approx`: true when only an approximate date is known (ancient events). The game spaces approximate events at least 100 years apart from their neighbours when building a question.
- `difficulty`: 1 easy, 2 medium, 3 hard.
- Spread events across the country's whole history, from ancient to the 2000s.

## places (at least 10)
- Cities, landmarks, natural features or historic sites that lie **inside the country's present-day borders**.
- `lat` and `lon` in decimal degrees, accurate to about 0.1°.
- `kind`: one of city, landmark, nature, historic.
- `clue`: a one-sentence fact shown after answering, under 160 characters.
- `difficulty`: 1 = famous (a capital or a world-famous landmark), 2 = known to engaged travellers, 3 = enthusiast.
- At most 1 place within 50 km of another, so tapping the map is never ambiguous.
