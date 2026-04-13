# Unix API

Unix epoch (seconds or milliseconds) utilities. All functions work with numeric Unix timestamps.

## Modules

### calculate

Unix timestamp arithmetic:

- `addUnix`, `diffUnix`
- `endOfQuarterForUnix`, `endOfUnix`
- `isBetweenUnix`
- `maxUnix`, `minUnix`, `sortUnix`
- `startOfQuarterForUnix`, `startOfUnix`
- `subtractUnix`

### convert

Unix timestamp conversion:

- `convertUnixToPlainDate`, `convertUnixToPlainDateTime`, `convertUnixToPlainTime`
- `convertUnixToUtc`, `convertUnixToZoned`

### get

Current Unix timestamps:

- `getUnixNow`

### parse

Parse Unix timestamps:

- `parseUnixDate`, `parseUnixTime`, `parseUnixUnit`

### validate

Validation helpers:

- `isValidUnixMilliseconds`, `isValidUnixSeconds`, `isValidUnixUnit`
