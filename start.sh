#!/usr/bin/env bash

target_commit=${target_commit:-}
source_commit=${source_commit:-}
patch_limit=${patch_limit:-10}
minor_limit=${minor_limit:-75}
directory=${directory:-.}
exclude=${exclude:-}
include_only=${include_only:-}
important_files=${important_files:-}
importance_rate=${importance_rate:-}
v_prefix=${v_prefix:-true}
is_alpha=${is_alpha:-false}
is_beta=${is_beta:-false}
is_rc=${is_rc:-false}
is_draft=${is_draft:-false}
is_prerelease=${is_prerelease:-false}
debug=${debug:-false}
create_tag=${create_tag:-true}
create_major_tag=${create_major_tag:-true}
create_latest_tag=${create_latest_tag:-true}
prerelease_tag=${prerelease_tag:-}
build_metadata=${build_metadata:-}

command_args=""

if [[ ${#source_commit} -gt 0 ]]; then
    command_args+=" --source-commit $source_commit"
    # (git checkout $source_commit || echo 1) 2>/dev/null
    # (git pull origin $source_commit || echo 1) 2>/dev/null
fi

if [[ ${#target_commit} -eq 0 ]]; then
    git pull
    target_commit=$(git log --no-merges --no-decorate --pretty=format:%H -n 1 HEAD^)
    echo "target: $target_commit"
fi

if [[ ${#patch_limit} -gt 0 ]]; then
    command_args+=" --patch-limit $patch_limit"
fi

if [[ ${#minor_limit} -gt 0 ]]; then
    command_args+=" --minor-limit $minor_limit"
fi

if [[ ${#directory} -gt 0 ]]; then
    command_args+=" --directory $directory"
fi

if [[ ${#exclude} -gt 0 ]]; then
    command_args+=" --exclude $exclude"
fi

if [[ ${#include_only} -gt 0 ]]; then
    command_args+=" --include-only $include_only"
fi

if [[ ${#important_files} -gt 0 ]]; then
    command_args+=" --important-files $important_files"
fi

if [[ "$v_prefix" == "false" ]]; then
    command_args+=" --remove-v-prefix"
fi

if [[ "$is_alpha" == "true" ]]; then
    command_args+=" --alpha"
fi

if [[ "$is_beta" == "true" ]]; then
    command_args+=" --beta"
fi

if [[ "$is_rc" == "true" ]]; then
    command_args+=" --rc"
fi

if [[ "$is_prerelease" == "true" ]]; then
    command_args+=" --prerelease"
fi

if [[ "$is_draft" == "true" ]]; then
    command_args+=" --draft"
fi

if [[ "$debug" == "true" ]]; then
    command_args+=" --debug"
fi

if [[ "$create_tag" == "true" ]]; then
    command_args+=" --create-tag"
fi

if [[ "$create_major_tag" == "true" ]]; then
    command_args+=" --create-major-tag"
fi

if [[ "$create_latest_tag" == "true" ]]; then
    command_args+=" --create-latest-tag"
fi

if [[ ${#importance_rate} -gt 0 ]]; then
    command_args+=" --importance $importance_rate"
fi
if [[ ${#prerelease_tag} -gt 0 ]]; then
    command_args+=" --prerelease-tag $prerelease_tag"
fi
if [[ ${#build_metadata} -gt 0 ]]; then
    command_args+=" --build-metadata $build_metadata"
fi

if [[ "$debug" == "true" ]]; then
    echo "Main command: python3 src/main.py $target_commit $command_args"
fi

python3 $ACTION_WORKDIR/src/main.py $target_commit $command_args
