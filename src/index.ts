import * as core from "@actions/core";
import * as github from "@actions/github";

import {
  getDiff,
  getFileList,
  readInputs,
  getLatestTag,
  parseGitIgnore,
  getFilesglob,
  updateTag,
  createTag,
} from "./utils.js";
import { log } from "./logger.js";

log.level = "info";
log.env = github.context.repo.repo;
log.showDate = false;

export async function run() {
  const inputs = await readInputs();
  if (inputs.debug) log.level = "debug";
  if (inputs.debug) console.table(inputs);

  let excludedFiles: string[] = [".git/**"];
  let includedFiles: string[] = [];

  if (inputs.excludeGitignore === true)
    excludedFiles = excludedFiles.concat(await parseGitIgnore());

  if (inputs.exclude.length > 0)
    excludedFiles = excludedFiles.concat(inputs.exclude);

  if (inputs.include.length > 0)
    includedFiles = includedFiles.concat(inputs.include);

  log.info("Analizying directory:", inputs.dir);

  const gh = github.getOctokit(inputs.githubToken);

  const latestTag = await getLatestTag(
    gh,
    github.context.repo,
    inputs.versionSep,
    inputs.prereleaseSep,
    inputs.buildSep
  );
  log.info("latest tag:", latestTag.tagString);
  console.table(latestTag);

  let diff = await getDiff(
    inputs.sourceCommit,
    inputs.targetCommit,
    inputs.dir,
    excludedFiles,
    includedFiles
  );

  log.info("diff");
  log.info(inputs.sourceCommit, "->", inputs.targetCommit);
  console.table(diff);

  core.setOutput("files-changed", diff.filesChanged);
  core.setOutput("files-added", diff.filesCreated);
  core.setOutput("files-removed", diff.filesDeleted);
  core.setOutput("insertions", diff.insertions);
  core.setOutput("deletions", diff.deletions);

  const exclude = await getFilesglob(excludedFiles);
  const include = await getFilesglob(includedFiles);

  const files = await getFileList(inputs.dir, include, exclude);
  let totalLines = 0;
  for (var i = 0; i < files.length; i++) {
    const file = files[i];
    totalLines += file.lines;
  }

  log.info("Total lines in project (now):", totalLines);
  totalLines =
    totalLines - Math.abs(diff.insertions) + Math.abs(diff.deletions);

  log.info("Total lines in project (before):", totalLines);
  log.info("Total files in project:", files.length);

  const insertionsChange = Math.abs(diff.insertions / totalLines) * 100;
  const deletionsChange = Math.abs(diff.deletions / totalLines) * 100;

  log.info("Deletions change detected:", deletionsChange, "%");
  log.info("insertions change detected:", insertionsChange, "%");

  const maxChange = Math.max(insertionsChange, deletionsChange);
  log.info("Max detected change:", maxChange, "%");

  core.setOutput("max-change-percentage", maxChange);
  core.setOutput(
    "min-change-percentage",
    Math.min(insertionsChange, deletionsChange)
  );
  core.setOutput(
    "avg-change-percentage",
    (insertionsChange + deletionsChange) / 2
  );
  core.setOutput(
    "cumulative-change-percentage",
    insertionsChange + deletionsChange
  );

  const newTag = updateTag(maxChange, latestTag, inputs);

  core.setOutput("version", newTag.tagString);
  core.setOutput("major", newTag.major);
  core.setOutput("minor", newTag.minor);
  core.setOutput("patch", newTag.patch);
  core.setOutput("prerelease", newTag.prerelease ?? "");
  core.setOutput("build-metadata", newTag.buildMetadata ?? "");

  log.info("New version");
  console.table(newTag);

  if (inputs.createTag === true) {
    await createTag(gh, newTag, inputs);
  }
}

run();
