# business

Business layer: the rules, validation and workflows that make HOPZ what it is.

- Called by: [[service]]
- Uses: [[datadomain]], [[function]], [[models]]
- Keep it free of HTTP, DB or vendor-specific code.

## Contents
- `user.business.js`: listUsers, getUser (404 if missing), registerUser (validates name/email, lowercases email, 409 on duplicate)

Part of [[project-hopz]].
