# UTC API

UTC instant utilities. All functions work with UTC-labeled ISO 8601 strings (ending in `Z` or with `+00:00` offset).

## Modules

### calculate

UTC timestamp arithmetic:

- `addUtc`, `diffUtc`
- `endOfQuarterForUtc`, `endOfUtc`
- `isBetweenUtc`
- `maxUtc`, `minUtc`, `sortUtc`
- `startOfQuarterForUtc`, `startOfUtc`
- `subtractUtc`

### chop

Strip UTC components:

- `chopUtc`

### convert

UTC conversion:

- `convertUtcToPlainDate`, `convertUtcToPlainDateTime`, `convertUtcToPlainTime`
- `convertUtcToUnix`, `convertUtcToZoned`

### get

Current UTC time:

- `getUtcNow`

### parse

Parse UTC components:

- `parseUtcDate`, `parseUtcTime`, `parseUtcUnit`

### validate

Validation helpers:

- `isValidUtc`
