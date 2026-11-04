# Garden planner

A small web app for planning an allotment: which beds hold which crops, and
when to sow and harvest them.

## Getting started

1. Install Node 20 or later.
2. Run `npm install`.
3. Run `npm start` and open the address it prints.

## How it is organised

- `src/beds.js` keeps the list of raised beds.
- `src/calendar.js` works out sowing and harvest dates from the frost dates.
- `settings.json` holds the frost dates and the beds you start with.

### Frost dates

The calendar counts back from the **last frost** for crops sown indoors and
forward from it for crops sown outside. Change the dates in `settings.json`
to match your area.

```js
const lastFrost = new Date(settings.frostDates.last);
```

## Known problems

- Beds can't be renamed yet.
- The calendar ignores leap years.

## Licence

Apache 2.0. See [LICENSE](LICENSE) for the full text.

| Crop     | Sow indoors | Sow outside |
|----------|-------------|-------------|
| Tomatoes | March       | June        |
| Beans    | April       | May         |
