## [2.0.1](https://github.com/mrmartineau/astro-d1-reactions/compare/v2.0.0...v2.0.1) (2026-11-04)

### Bug Fixes

- load cloudflare:workers lazily in loadStats ([620e3ef](https://github.com/mrmartineau/astro-d1-reactions/commit/620e3ef6935955a73f8aaced0acffe7950020b71))

# [2.0.0](https://github.com/mrmartineau/astro-d1-reactions/compare/v1.0.0...v2.0.0) (2026-11-04)

- feat!: support the Astro 6+ Cloudflare adapter, drop Astro 5 ([7a91e52](https://github.com/mrmartineau/astro-d1-reactions/commit/7a91e52da90fdcdb2442e8ec57ff9b716a250ce8))

### Bug Fixes

- keep spaces around links in stats activity ([96149e1](https://github.com/mrmartineau/astro-d1-reactions/commit/96149e16e0a33e4773e2119524be3e2f95b42fe8))

### Features

- add --rx-radius and --rx-border-width theme variables ([5b13719](https://github.com/mrmartineau/astro-d1-reactions/commit/5b1371924f7f56727f2e6176e106f565c8f177f5))
- add agent skill ([14db39d](https://github.com/mrmartineau/astro-d1-reactions/commit/14db39dfffcc20958158b8bf0881abd6b6419666))

### BREAKING CHANGES

- Astro 5 is no longer supported. `loadStats()` no longer
  takes `locals`; call `loadStats(activityLimit?)` instead.

# 1.0.0 (2026-10-13)

### Bug Fixes

- update readme ([8f6e202](https://github.com/mrmartineau/astro-d1-reactions/commit/8f6e20289dcbe0f834f6e882ad176954a32bb7e6))

### Features

- initial release ([56a1c74](https://github.com/mrmartineau/astro-d1-reactions/commit/56a1c744b10151ca78b0ea852899f78051ad358e))
