// The root entry is intentionally minimal — cf-common's contract is its
// subpath exports, so tree-shaking is automatic. Import a module directly:
//
//   import { getBinding } from '@rtorcato/cf-common/env'
//   import { CloudflareError } from '@rtorcato/cf-common/errors'
//
// ponytail: kept as a stable, side-effect-free anchor for `.`; modules wire in
// as named subpaths, not a barrel re-export.
export {}
