import argparse


parser = argparse.ArgumentParser(
    prog="git-automatic-version",
    description="Calculates the next version based on a percentage of changes",
    epilog="@HenryCabarcas",
)

parser.add_argument("target_commit")  # positional argument
parser.add_argument(
    "--source-commit",
    nargs="?",
    default="",
    help="Source hash of commit to make the comparison",
)
parser.add_argument(
    "--patch-limit",
    nargs="?",
    default="10",
    help="% top limit of changes to increase a patch version vX.Y.(Z+1)",
)
parser.add_argument(
    "--minor-limit",
    nargs="?",
    default="75",
    help="% top limit of changes to increase a minor version vX.(Y+1).Z",
)
parser.add_argument(
    "--directory",
    nargs="?",
    default=".",
    help="Directory to check the changes",
)
parser.add_argument(
    "--exclude",
    nargs="*",
    action="append",
    type=str,
    help="List of files, paths, patterns to exclude",
)
parser.add_argument(
    "--include-only",
    nargs="*",
    action="append",
    type=str,
    help="List of files, paths, patterns to include only",
)
parser.add_argument(
    "--important-files",
    nargs="*",
    action="append",
    type=str,
    help="Files to consider the changes the most",
)
parser.add_argument(
    "--importance",
    nargs="?",
    default="1.1",
    help="Important files importance",
)
parser.add_argument(
    "--remove-v-prefix",
    action="store_true",
    help="Include the 'v' prefix in the version: vX.Y.Z",
)
parser.add_argument(
    "--alpha",
    action="store_true",
    help="This is an alpha version",
)
parser.add_argument(
    "--beta",
    action="store_true",
    help="This is a beta version",
)

parser.add_argument(
    "--rc",
    action="store_true",
    help="This is a release candidate version",
)
parser.add_argument(
    "--draft",
    action="store_true",
    help="This is a draft version",
)
parser.add_argument(
    "--prerelease",
    action="store_true",
    help="This is a prerelease version",
)
parser.add_argument(
    "--create-tag",
    action="store_true",
    help="Create tag after calculating it",
)
parser.add_argument(
    "--create-latest-tag",
    action="store_true",
    help="Create tag after calculating it",
)
parser.add_argument(
    "--create-major-tag",
    action="store_true",
    help="Create tag after calculating it",
)
parser.add_argument(
    "--prerelease-tag",
    nargs="?",
    default="",
    help="Prerelease tag",
)

parser.add_argument(
    "--build-metadata",
    nargs="?",
    default="",
    help="Build metadata tag",
)

parser.add_argument(
    "--debug",
    action="store_true",
    help="Print debug logs",
)

args = parser.parse_args()
