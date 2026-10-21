# V0.4 GitHub achievement guide

RepoVerity V0.4 includes an **educational guide** and a **local, self-reported checklist**. This does not certify that GitHub has awarded a badge, and it cannot award badges, unlock tiers or create follower/PR/star activity.

## How to use it

1. Look up a public GitHub profile.
2. Open **Achievement lab**.
3. For each currently obtainable badge, choose **Not started**, **Working on it**, or **I earned this**.
4. Click **View GitHub badges** to confirm the real badge on GitHub before selecting “I earned this”.
5. Your selections are stored in this browser, keyed to the viewed username. They are never uploaded to RepoVerity.

## Reference: generally available achievement types

The following requirements and tiers are **community-reported**; GitHub may change or retire them without notice. GitHub's official profile documentation describes the Achievements feature but does not guarantee these numerical thresholds.

| Achievement | Commonly reported trigger | Tiers (reported) |
| --- | --- | --- |
| Pull Shark | Merge pull requests | 2 / 16 / 128 / 1,024 merged PRs |
| Starstruck | Stars on one repository you own | 16 / 128 / 512 / 4,096 |
| Galaxy Brain | Accepted answers in Discussions | 2 / 8 / 16 / 32 |
| Pair Extraordinaire | Legitimate co-authored, merged PRs | 1 / 10 / 24 / 48 |
| Quickdraw | Close an issue or PR within five minutes | Single tier |
| YOLO | Merge a PR without a code review | Single tier |
| Public Sponsor | Publicly sponsor an eligible maintainer | Single tier; involves payment |

RepoVerity also lists two **historical, not newly obtainable** recognitions (Arctic Code Vault and Mars 2020 Contributor), which have no tracking controls.

Some limited-preview community-discussed achievements have changed availability over time, so they are intentionally not promoted as generally earnable in this release.

## What the data means

- **Earned** means **the viewer selected it manually**; RepoVerity cannot verify it.
- Starstruck's per-repository number is calculated only from **up to 100 recently updated public owned repositories** in the current public profile sample. This is not a full account history or a guarantee of the official achievement.
- The app does not read private repositories or earned badge history.
- The checklist is saved to localStorage under `repoverity:achievements:v1`, with up to 25 profiles.
- Browser privacy mode, storage cleanup or switching devices can remove these entries.

## Responsible participation

GitHub's achievements are meant to recognize real events. Do not open fake Issues, stage collaborations, buy stars, use follow bots, bypass mandatory reviews or create spam PRs for the sake of a badge. Contribute because a project would benefit from your work.

## Further reading

- [GitHub profile reference and Achievements](https://docs.github.com/en/account-and-profile/reference/profile-reference#earning-achievements)
- [GitHub contribution criteria](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference)
- [Community-researched achievement guide (not official GitHub thresholds)](https://github.com/SharmARohitt/Github-Achievement)
