import os
import utils.utils as utils
from utils import args, log

log.set_env("auto-semver")
log.set_level("info")
log.hide_date()
log.hide_file()


def main():
    if args.debug:
        log.set_level("debug")
    log.info("Automatic SemVer calculation started")
    current_directory = os.path.relpath(os.getcwd())

    if args.directory:
        current_directory = args.directory

    if args.exclude:
        args.exclude = utils.unpack_list(args.exclude)
    else:
        args.exclude = []

    if args.include_only:
        args.include_only = utils.unpack_list(args.include_only)
    else:
        args.include_only = []

    if not "__pycache__" in args.exclude:
        args.exclude.append("__pycache__")
    if not ".venv" in args.exclude:
        args.exclude.append(".venv")
    if not ".git*" in args.exclude:
        args.exclude.append(".git*")

    log.debug(args)
    log.info("Listing files and counting lines")

    files = utils.get_files_list(
        current_directory,
        exclude=args.exclude.copy(),
        only=args.include_only.copy(),
    )
    log.debug("Files:", files)

    total_lines = utils.get_files_lines_count(files)
    log.debug("Current commit total lines:", total_lines)

    log.info("Calculating changes")
    changes = utils.get_diff(
        args.source_commit,
        args.target_commit,
        directory=current_directory,
        exclude=args.exclude,
        include=args.include_only,
    )

    total_lines = total_lines - int(changes["insertions"]) + int(changes["deletions"])
    if total_lines == 0 or total_lines < 0:
        total_lines = max(int(changes["insertions"]), int(changes["deletions"]))
    log.debug("Target commit total lines (difference):", total_lines)

    changes["insertions%"] = abs(round(changes["insertions"] / total_lines * 100, 2))
    changes["deletions%"] = abs(round(changes["deletions"] / total_lines * 100, 2))
    log.debug("Changes:", changes)

    limits = {"minor": float(args.minor_limit), "patch": float(args.patch_limit)}
    log.debug("Limits:", limits)

    log.info("Retrieving current version")
    current_version = utils.get_current_version()
    log.debug("Current Version:", current_version)
    log.info(f"Current version:", current_version["str"])
    log.info("Calculating new version")
    version_str, version = utils.calculate_version(
        current_version.copy(),
        changes,
        limits,
        enable_prefix=not args.remove_v_prefix,
        alpha=args.alpha,
        beta=args.beta,
        rc=args.rc,
        prerelease_tag=args.prerelease_tag,
        build_metadata=args.build_metadata,
    )
    if not version_str and not version:
        log.warn("No changes detected, exiting")
        return 0

    commands = [
        f'echo "version_str=\'{version_str}\'" >> "$GITHUB_OUTPUT"',
        f'echo "major=\'{version["major"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "minor=\'{version["minor"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "patch=\'{version["patch"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "prerelease=\'{version["prerelease"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "build_metadata=\'{version["build_metadata"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "files_changed=\'{changes["files_changed"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "files_added=\'{changes["files_added"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "files_removed=\'{changes["files_removed"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "insertions=\'{changes["insertions"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "deletions=\'{changes["deletions"]}\'" >> "$GITHUB_OUTPUT"',
        f'echo "max_percentage=\'{max(changes["insertions%"], changes["deletions%"])}\'" >> "$GITHUB_OUTPUT"',
        f'echo "min_percentage=\'{min(changes["insertions%"], changes["deletions%"])}\'" >> "$GITHUB_OUTPUT"',
        f'echo "avg_percentage=\'{round((changes["insertions%"]+ changes["deletions%"])/2,2)}\'" >> "$GITHUB_OUTPUT"',
        f'echo "cumulative_percentage=\'{round(changes["insertions%"]+ changes["deletions%"],2)}\'" >> "$GITHUB_OUTPUT"',
    ]
    utils.run_command(" ; ".join(commands))
    log.success(f"New version: {version_str}")
    log.info(f'{current_version["str"]} -> {version_str}')
    log.debug("New Version object:", version)

    if args.create_tag:
        if version_str == current_version["str"]:
            log.warn("No version change, skipping creation")
            return
        utils.create_version_tag(
            version_str,
            args.source_commit,
            draft=args.draft,
            prerelease=args.prerelease,
        )


if __name__ == "__main__":
    main()
