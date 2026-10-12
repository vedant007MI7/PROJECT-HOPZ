# wrapper

Wrapper layer: thin adapters around external things (third-party APIs, SDKs, DB drivers, libraries) so the rest of HOPZ never depends on them directly.

- Used by: [[service]], [[datadomain]]
- Uses: [[models]]
- Swapping a vendor should only touch this folder.

## Contents
- `logger.js`: `info` / `warn` / `error` wrapper around console (swap to pino/winston here)

Part of [[project-hopz]].
