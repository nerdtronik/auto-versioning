Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const tslib_1 = require("tslib");
// import core from "@actions/core";
const github_1 = tslib_1.__importDefault(require("@actions/github"));
const utils_1 = require("./utils/utils");
const logger_1 = require("./utils/logger");
logger_1.log.level = "info";
logger_1.log.env = github_1.default.context.repo.repo;
logger_1.log.showDate = false;
async function run() {
    const inputs = await (0, utils_1.readInputs)();
    if (inputs.debug)
        logger_1.log.level = "debug";
    logger_1.log.debug(inputs);
    let excludedFiles = [".git/**"];
    let includedFiles = [];
    if (inputs.excludeGitignore === true)
        excludedFiles = excludedFiles.concat(await (0, utils_1.parseGitIgnore)());
    if (inputs.exclude.length > 0)
        excludedFiles = excludedFiles.concat(inputs.exclude);
    if (inputs.include.length > 0)
        includedFiles = includedFiles.concat(inputs.include);
    logger_1.log.info("Analizying directory:", inputs.dir);
    const gh = github_1.default.getOctokit(inputs.githubToken);
    const latestTag = await (0, utils_1.getLatestTag)(gh, github_1.default.context.repo, inputs.prereleaseSep, inputs.buildSep);
    let diff = await (0, utils_1.getDiff)(inputs.sourceCommit, inputs.targetCommit, inputs.dir, excludedFiles, includedFiles);
    logger_1.log.info("diff");
    console.table(diff);
    logger_1.log.info("latest tag:", latestTag.tagString);
    console.table(latestTag);
    const exclude = await (0, utils_1.getFilesglob)(excludedFiles);
    const include = await (0, utils_1.getFilesglob)(includedFiles);
    const files = await (0, utils_1.getFileList)(inputs.dir, include, exclude);
    let totalLines = 0;
    files.forEach((file) => {
        totalLines += file.lines;
    });
    logger_1.log.info("Total lines in project (now):", totalLines);
    totalLines = totalLines - diff.insertions + diff.deletions;
    logger_1.log.info("Total lines in project (before):", totalLines);
    logger_1.log.info("Total files in project:", files.length);
}
//# sourceMappingURL=index.js.map
