# Security policy

RepoVerity V0.1 reads public GitHub REST endpoints from a browser. It does not require authentication, GitHub API secrets or permission to access private repositories.

**Do not put GitHub personal access tokens, passwords, OAuth client secrets or other credentials in front-end environment variables.** Vite variables prefixed with `VITE_` are embedded in the client bundle and are not a secure place for secrets.

If you discover a security issue, avoid sharing exploitation details in a public issue. Contact the maintainer privately via the contact methods on [their GitHub profile](https://github.com/kobrymoataz).

This repository contains an experimental developer tool. Its repository metadata indicators must not be interpreted as a vulnerability scan or security certification.
