# datadomain

Data domain layer: repositories and data access (DB queries, storage, persistence).

- Called by: [[business]]
- Uses: [[models]], [[wrapper]] (for DB/storage clients)
- Returns models, never raw DB rows.

## Contents
- `user.repository.js`: findAll, findById, findByEmail, create — in-memory `Map` for now, async so a real DB can drop in

Part of [[project-hopz]].
