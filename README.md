# Automatic Versioning tag calculator

This actions calculates your repo versioning tags based on [Semantic Versioning 2.0.0 | Semantic Versioning](https://semver.org/spec/v2.0.0.html) syntaxis, it calculates to change major, minor and patch version based on a percentage of changes between commits.
For example, if your current version is `v1.2.1` if you merge a pr with changes of 75%, your next version will be a major version, resulting in `v2.0.0`, but if the changes are 30%, your next version will be `v1.3.0`, and so on. These thresholds can be modified with the instructions below.

> Note: This doesn't follow the SemVer parameters to increase a version (breaking changes, API compatibility changes, etc), this action is based only in changes percentages between commits

## Usage

<!-- start usage -->

```yaml
- uses: HenryCabarcas/auto-versioning@v1.0.0
  with:
    # Commit to compare changes against (usually branch merging to or pr target)
    # This uses the commit id/sha
    #
    # Default: ""
    target-commit: ""

    # Commit to compare changes to target-commit (usually pr branch to merge)
    # This uses the commit id/sha
    #
    # Default: ""
    # Required
    source-commit: ""

    # Top limit to increase the patch version vX.Y.(Z+1)
    # If the changes are under this limit (0 < change % <= patch-limit)
    # it will only increase the patch version
    #
    # Default: 10
    patch-limit: ""

    # Top limit to increase the minor version vX.(Y+1).Z
    # If the changes are under this limit and over the patch-limit (patch-limit < change % <= minor-limit)
    # it will only increase the minor version and set patch version to 0
    #
    # Default: 65
    minor-limit: ""

    # Base directory to check the changes, the script will cd to this dir and check the changes there
    #
    # Default: "."
    directory: ""

    # List of files, paths, patterns (./*path*) to exclude from changes checking
    # (space separated)
    #
    # Default: ""
    exclude: ""

    # List of files, paths, patterns (./*path*) to include only for changes checking
    # (space separated)
    # This will avoid any file that doesn't match the list
    #
    # Default: ""
    include-only: ""

    # List of files, paths, patterns (./*path*) to mark as important for changes checking
    # (space separated)
    #
    # Default: ""
    important-files: ""

    # How important an important file is
    # This will multiply the total change by the factor of this
    # value every time an important file is found
    #
    # Default: 1.1
    importance-rate: ""

    # Include the 'v' prefix in the version tag -> vX.Y.Z
    #
    # Default: true
    v-prefix: ""

    # Mark this version as an alpha version
    # This will add the suffix '-alpha' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-alpha.X' every time following alpha versions are published without big changes
    #
    # Default: false
    is-alpha: ""

    # Mark this version as a beta version
    # This will add the suffix '-beta' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-beta.X' every time following beta versions are published without big changes
    #
    # Default: false
    is-beta: ""

    # Mark this version as a release candidate version
    # This will add the suffix '-rc' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-rc.X' every time following release candidate versions
    # are published without big changes
    #
    # Default: false
    is-rc: ""

    # Mark this version as a draft
    #
    # Default: false
    is-draft: ""

    # Mark this version as a prerelease
    #
    # Default: false
    is-prerelease: ""

    # Show debug messages
    #
    # Default: false
    debug: ""

    # Create GitHub release tag on finish
    #
    # Default: true
    create-tag: ""

    # Prerelease info to add at the end of the version tag
    # This is added as a suffix as '-prerelease-tag'
    #
    # Default: ""
    prerelease-tag: ""

    # Build metadata to add at the end of the version tag
    # This is added as a suffix as '+build-metadata'
    #
    # Default: ""
    build-metadata: ""

    # Github Token to create the tag at the end of the process
    # (required if want to create tag at the end)
    #
    # Default: ""
    github-token: ""
```

<!-- end usage -->

## Scenarios

- [Pull Request](#pull-request)
- [Push](#push)
- [Static commit merge](#static-commit-merge)

### Pull Request

```yaml
on:
    pull_request:
        branches: ["main"]
jobs:
    pr-workflow:
        runs-on: ubuntu-latest
        steps:
           # This step is required
            - name: checkout source
              uses: actions/checkout@master
              with:
                fetch-depth: 2  # Fetch enough history to compare commits

            - name: Calculate Next Version
              uses: HenryCabarcas/auto-versioning@v1.0.0
              id: versioning
              with:
                target-commit: ${{ github.event.pull_request.base.sha }}
                source-commit: ${{ github.event.pull_request.head.sha }}
                github-token: ${{ secrets.GH_TOKEN }}
                is-rc: "true" # Publish as a release candidate version
                is-draft: "true" # Publich as draft version
                build-metadata: ${{ github.workflow_sha }} # Optional build metadata
                create-tag: "false" # Don't create tag, only returns at output
                debug: "true" # Show debug messages

            - name: Show Output
              run: echo '${{ toJson(steps.versioning.outputs) }}'

```

### Push

```yaml
on:
    push:
        branches: ["main"]
jobs:
    push-workflow:
        runs-on: ubuntu-latest
        steps:
            # This step is required
            - name: checkout source
              uses: actions/checkout@master
              with:
                fetch-depth: 2  # Fetch enough history to compare commits

            - name: Total Changes
              uses: HenryCabarcas/auto-versioning@v1.0.0
              id: versioning
              with:
                source-commit: ${{ github.event.after }}
                # target-commit is not required here since is calculated
                # on runtime based on the merge branch
                github-token:  ${{ secrets.GH_TOKEN }}

            - name: Show Output
              run: echo '${{ toJson(steps.versioning.outputs) }}'

```

### Static commit merge

```yaml
on:
    push:
        branches: ["main"]
jobs:
    push-workflow:
        runs-on: ubuntu-latest
        steps:
            # This step is required
            - name: checkout source
              uses: actions/checkout@master
              with:
                fetch-depth: 0  # Fetch all history to compare commits

            - name: Total Changes
              uses: HenryCabarcas/auto-versioning@v1.0.0
              id: versioning
              with:
                source-commit: ${{ github.event.after }}
                target-commit: "<commit-sha>"
                # this will compare the latest commit
                # in the branch with this commit
                github-token:  ${{ secrets.GH_TOKEN }}

            - name: Show Output
              run: echo '${{ toJson(steps.versioning.outputs) }}'
```
