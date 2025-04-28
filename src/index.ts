import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  PushEvent,
  PullRequestEvent,
} from "@octokit/webhooks-definitions/schema";
import {
  getDiff,
  getFileList,
  readInputs,
  getLatestTag,
  parseGitIgnore,
  getFilesglob,
} from "./utils.js";
import { log } from "./logger.js";

log.level = "info";
log.env = github.context.repo.repo;
log.showDate = false;

export async function run() {
  let payload: PushEvent | PullRequestEvent;
  if (github.context.eventName === "push") {
    payload = github.context.payload as PushEvent;
    payload
    core.info(`The head commit is: ${payload.head_commit}`);
  } else if (github.context.eventName === "pull_request") {
    payload = github.context.payload as PullRequestEvent;
  }
  
  const inputs = await readInputs();
  if (inputs.debug) log.level = "debug";
  log.debug(inputs);

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
    inputs.prereleaseSep,
    inputs.buildSep
  );

  let diff = await getDiff(
    inputs.sourceCommit,
    inputs.targetCommit,
    inputs.dir,
    excludedFiles,
    includedFiles
  );
  log.info("diff");
  console.table(diff);
  log.info("latest tag:", latestTag.tagString);
  console.table(latestTag);
  const exclude = await getFilesglob(excludedFiles);
  const include = await getFilesglob(includedFiles);
  const files = await getFileList(inputs.dir, include, exclude);
  let totalLines = 0;
  files.forEach((file) => {
    totalLines += file.lines;
  });

  log.info("Total lines in project (now):", totalLines);
  totalLines = totalLines - diff.insertions + diff.deletions;
  log.info("Total lines in project (before):", totalLines);
  log.info("Total files in project:", files.length);
}

run();
