---
'@rtorcato/cf-common': patch
---

`presignR2Url` now rejects an empty bucket and a bucket of `.` or `..` with the non-exposed 500 `R2_PRESIGN_INVALID`, instead of signing a `//key` or `/../key` path.
