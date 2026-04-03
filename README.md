# Zakat Calculator

A lightweight worldwide zakat calculator with:

- live gold and silver spot pricing
- global currency conversion
- net-wealth zakat calculation at 2.5%
- configurable gold/silver nisab, jewelry treatment, and debt deduction
- separate handling for agriculture, livestock, and rikaz
- source links to Qur'an, Hadith, and contemporary zakat guidance

## Run locally

```bash
npm start
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

## Notes

- Live metal prices come from [Gold API](https://gold-api.com/docs).
- Currency conversion comes from [Frankfurter](https://frankfurter.dev/).
- If live prices are unavailable, use the manual per-gram override inside the page.
- This project is an educational calculator, not a fatwa. Review unusual cases with a qualified scholar.
