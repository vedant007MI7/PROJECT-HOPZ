# function

Function layer: small reusable helpers and utilities (formatting, parsing, calculations).

- Called by: any layer
- Uses: [[models]] only
- Prefer pure functions: same input, same output, no side effects.

## Contents
- `app-error.js`: `AppError(message, status)`, which is turned into a JSON error by `app.js`
- `response.js`: `ok(data)` / `fail(message)` response envelope
- `validators.js`: `isNonEmptyString`, `isEmail`

Part of [[project-hopz]].
