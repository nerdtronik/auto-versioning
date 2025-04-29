# Automatic Versioning Tag Calculator

This actions calculates your repo versioning tags based on [Semantic Versioning 2.0.0 | Semantic Versioning](https://semver.org/spec/v2.0.0.html) syntaxis, it calculates to change major, minor and patch version based on a percentage of changes between commits.
For example, if your current version is `v1.2.1` if you merge a pr with changes of 75%, your next version will be a major version, resulting in `v2.0.0`, but if the changes are 30%, your next version will be `v1.3.0`, and so on. These thresholds can be modified with the instructions below.

> Note: This doesn't follow the SemVer parameters to increase a version (breaking changes, API compatibility changes, etc), this action is based only in changes percentages between commits

## Usage

<!-- start usage -->

```yaml
- uses: nerdtronik/auto-versioning@v2
  with:
    # Commit to compare changes against (usually branch merging to or pr target)
    # This uses the commit id/sha
    #
    # Default: "${{ github.event.pull_request.base.sha || github.event.before }}"
    target-commit: ${{ github.event.pull_request.base.sha || github.event.before }}

    # Commit to compare changes to target-commit (usually pr branch to merge)
    # This uses the commit id/sha
    #
    # Default: "${{ github.event.pull_request.head.sha || github.event.after }}"
    source-commit: ${{ github.event.pull_request.head.sha || github.event.after }}

    # Top limit to increase the patch version vA.B.(C+1)
    # If the changes are under this limit (0 < change % <= patch-limit)
    # it will only increase the patch version
    #
    # Default: 10
    patch-limit: 10

    # Top limit to increase the minor version vA.(B+1).C"
    # If the changes are under this limit and over the patch-limit (patch-limit < change % <= minor-limit)
    # it will only increase the minor version and set patch version to 0
    #
    # Default: 75
    minor-limit: 75

    # Base directory to check the changes, the script will cd to this dir and check the changes there
    #
    # Default: "."
    directory: "."

    # List of files, paths, patterns (./*path*) to exclude from changes checking
    # (comma separated)
    #
    # Default: ""
    exclude: ""

    # List of files, paths, patterns (./*path*) to include only for changes checking
    # (comma separated)
    # This will avoid any file that doesn't match the list
    #
    # Default: ""
    include: ""

    # Exclude files included in the .gitigore file
    #
    # Default: true
    exclude-gitignore: true

    # Include the 'v' prefix in the version tag -> vX.Y.Z
    #
    # Default: true
    v-prefix: true

    # Mark this version as an alpha version
    # This will add the suffix '-alpha' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-alpha.X' every time following alpha versions are published without big changes
    #
    # Default: false
    is-alpha: false

    # Mark this version as a beta version
    # This will add the suffix '-beta' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-beta.X' every time following beta versions are published without big changes
    #
    # Default: false
    is-beta: false

    # Mark this version as a release candidate version
    # This will add the suffix '-rc' to the version and will increase only
    # the minor and major versions, also, handles multiple subversions
    # with '-rc.X' every time following release candidate versions
    # are published without big changes
    #
    # Default: false
    is-rc: false

    # Key to use when version is Alpha version
    # For example, if this value is 'a', the version will be 'vA.B.C-a'
    # instead of 'vA.B.C-alpha'
    #
    # Default: "alpha"
    alpha-key: alpha

    # Key to use when version is Beta version
    # For example, if this value is 'b', the version will be 'vA.B.C-b'
    # instead of 'vA.B.C-beta'
    #
    # Default: "beta"
    beta-key: beta

    # Key to use when version is Rc version
    # For example, if this value is 'r', the version will be 'vA.B.C-r'
    # instead of 'vA.B.C-rc'
    #
    # Default: "rc"
    rc-key: rc

    # Mark this version as a draft
    #
    # Default: false
    is-draft: false

    # Mark this version as a prerelease
    #
    # Default: false
    is-prerelease: false

    # Show debug messages
    #
    # Default: false
    debug: false

    # Create GitHub release tag on finish
    #
    # Default: true
    create-tag: true

    # Create GitHub release tag on finish with only the major version (vA)
    #
    # Default: true
    create-major-tag: true

    # Create GitHub release tag on finish with only the major and minor version (vA.B)
    #
    # Default: true
    create-minor-tag: true

    # Create GitHub latest release tag on finish
    #
    # Default: true
    create-latest-tag: true

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

    # Separator to use with the prerelease tag (alpha,beta,rc)
    # For example: 'vA.B.C<sep>alpha'
    #
    # Default: "-"
    prerelease-separator: "-"

    # Separator to use with the build-metadata tag
    # For example: 'vA.B.C<sep><build-metadata>>'
    #
    # Default: "+"
    build-separator: "+"

    # Separator tu use in between the version string (vA<sep>B<sep>C)
    # Example: with this defined as '_' the version will be 'vA_B_C'
    #
    # Default: "."
    version-separator: "."

    # Github Token to create the tag at the end of the process
    # (required if want to create tag at the end)
    #
    # Default: ${{ github.token }}
    github-token: ${{ github.token }}
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
    permissions:
      contents:
        write # This is required if you don't set 'github-token'
        # and you want to create the tag release
    steps:
      # This step is required
      - name: checkout source
        uses: actions/checkout@v4
        with:
          fetch-depth: 2 # Fetch enough history to compare commits

      - name: Calculate Next Version
        uses: nerdtronik/auto-versioning@v2
        id: versioning
        with:
          is-rc: true # Publish as a release candidate version
          is-draft: true # Publich as draft version
          build-metadata: ${{ github.workflow_sha }} # Optional build metadata
          create-tag: false # Don't create tag, only returns at output
          debug: true # Show debug messages

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
    permissions:
      contents:
        write # This is required if you don't set 'github-token'
        # and you want to create the tag release
    steps:
      # This step is required
      - name: checkout source
        uses: actions/checkout@master
        with:
          fetch-depth: 2 # Fetch enough history to compare commits

      - name: Total Changes
        uses: HenryCabarcas/auto-versioning@v1.0.15
        id: versioning

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
    permissions:
      contents: write # This is required if you don't set 'github-token'
                      # and you want to create the tag release
    steps:
      # This step is required
      - name: checkout source
        uses: actions/checkout@master
        with:
          fetch-depth: 0  # Fetch all history to compare commits

      - name: Total Changes
        uses: HenryCabarcas/auto-versioning@v1.0.15
        id: versioning
        with:
          source-commit: ${{ github.event.after }}
          target-commit: "<commit-sha>"
          # this will compare the latest commit
          # in the branch with this commit

      - name: Show Output
        run: echo '${{ toJson(steps.versioning.outputs) }}'
```

## Inputs

| Field                    | Default                                                              | Description                                                                                            |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **target-commit**        | `${{ github.event.pull_request.base.sha \|\| github.event.before }}` | Commit to compare changes against (usually branch merging to)                                          |
| **source-commit**        | `${{ github.event.pull_request.head.sha \|\| github.event.after }}`  | Commit to compare changes to target-commit (usually pr branch to merge)                                |
| **patch-limit**          | 10                                                                   | Top how many % of changes limit to increase a patch version vA.B.(C+1)                                 |
| **minor-limit**          | 75                                                                   | Top how many % of changes limit to increase a minor version vA.(B+1).C                                 |
| **directory**            | `.`                                                                  | Base directory to check the changes                                                                    |
| **exclude**              | `empty`                                                              | List of files, paths, patterns (`./*path*`) to exclude from changes checking (comma separated)         |
| **include**              | `empty`                                                              | List of files, paths, patterns (`./*path*`) to include only for changes checking (comma separated)     |
| **exclude-gitignore**    | `true`                                                               | Parse gitignore files to exlude comparing files based on the content of those gitinores (default true) |
| **v-prefix**             | `true`                                                               | Include the 'v' prefix in the version tag: vA.B.C                                                      |
| **is-alpha**             | `false`                                                              | Mark this version as an alpha                                                                          |
| **is-beta**              | `false`                                                              | Mark this version as a beta                                                                            |
| **is-rc**                | `false`                                                              | Mark this version as a release candidate                                                               |
| **is-draft**             | `false`                                                              | Mark this version as a draft (in GitHub)                                                               |
| **is-prerelease**        | `false`                                                              | Mark this version as a prerelease (in GitHub)                                                          |
| **alpha-key**            | `alpha`                                                              | Text to put if the version is alpha (default 'alpha')                                                  |
| **beta-key**             | `beta`                                                               | Text to put if the version is beta (default 'beta')                                                    |
| **rc-key**               | `rc`                                                                 | Text to put if the version is rc (default 'rc')                                                        |
| **debug**                | `false`                                                              | Show debug messages                                                                                    |
| **create-tag**           | `true`                                                               | Create release tag after calculating it                                                                |
| **create-major-tag**     | `true`                                                               | Create release major tag after calculating it. (Ex. v3)                                                |
| **create-minor-tag**     | `true`                                                               | Create release minor tag after calculating it. (Ex. v3.1)                                              |
| **create-latest-tag**    | `true`                                                               | Create release latest tag after calculating it                                                         |
| **prerelease-tag**       | `empty`                                                              | Prerelease tag to add at the end of the version tag (overrides defaults: alpha,beta,rc)                |
| **build-metadata**       | `empty`                                                              | Build metadata to add at the end of the version tag                                                    |
| **prerelease-separator** | `-`                                                                  | eparator for the prerelease tag (A.B.C<sep>tag), defaults to '-'                                       |
| **build-separator**      | `+`                                                                  | Separator for the build-metadata tag (A.B.C<sep>tag), defaults to '+'                                  |
| **version-separator**    | `.`                                                                  | Separator for the version tag (A<sep>B<sep>C), defaults to '.'                                         |
| **github-token**         | `${{ github.token }}`                                                | Github Token to create the tag at the end of the process (required if want to create tag at the end)   |

## Outputs

| Field                            | Type               | Description                                       |
| -------------------------------- | ------------------ | ------------------------------------------------- |
| **version_str**                  | `string`           | Calculated version string                         |
| **major**                        | `number`           | Version major value                               |
| **minor**                        | `number`           | Version minor value                               |
| **patch**                        | `number`           | Version patch value                               |
| **prerelease**                   | `string`           | Version prerelease info                           |
| **build-metadata**               | `string`           | Version build-metadata info                       |
| **files-changed**                | `number`           | How many files were changed between commits       |
| **files-added**                  | `number`           | How many files were added between commits         |
| **files-removed**                | `number`           | How many files were removed between commits       |
| **insertions**                   | `number`           | How many lines were added between commits         |
| **deletions**                    | `number`           | How many lines were removed between commits       |
| **max-change-percentage**        | `number (decimal)` | The maximum change percentage between commits     |
| **min-change-percentage**        | `number (decimal)` | The minimum change percentage between commits     |
| **avg-change-percentage**        | `number (decimal)` | The average change percentage between commits     |
| **cumulative-change-percentage** | `number (decimal)` | The sum of all change percentages between commits |
