# KONGA Roadmap

This file contains the development roadmap for the upcoming release of KONGA, as well as the project backlog.

## Kong Manager parity update — October 2026

The current parity implementation is complete through Phase 6. The work was tested against
Kong 3.9.3 (traditional-compatible router, Postgres, WASM disabled) and the Konga UI was
rebuilt, restarted, and checked with Playwright after each completed slice.

- Phase 1: retired the obsolete APIs module and Kong 3.x dead code.
- Phase 2: added the schema-driven renderer improvements and coverage tests.
- Phase 3: added Kong 3.x upstream fields, health thresholds, SRV-name support, and target tags.
- Phase 4: added CA Certificates, Key Sets, Keys, and Vaults.
- Phase 5: added Tag Browser, deployment capability visibility, and existing operations visibility.
- Phase 6: added runtime log-level control and Prometheus metrics viewing.

The latest parity commit is `c5012df`. The static suite currently passes 105 tests. The unrelated
route-chip work remains separate and uncommitted.

&nbsp;
&nbsp;

## v0.7.0

This section is an early list of some of the features, enhancements, and other improvements tentatively planned or already implemented for the v0.7.0 release of KONGA.  Note that this is by no means a comprehensive changelog or release plan, and may exclude important additions, bug fixes, and documentation tasks; it is just a reference point with the highlights.

1. #### Massive refactoring and logic improvements.
2. #### Health checks and notifications.
3. #### Full Https support.
4. #### Relative paths support.
5. #### Out of the box integration with Cassandra.
6. #### Consumer exporting.
