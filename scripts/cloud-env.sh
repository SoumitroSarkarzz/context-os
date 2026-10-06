#!/usr/bin/env bash
# Source this only in the prepared Codex cloud workspace. It changes no repository files.
if [ -f /workspace/.context-linux/env.sh ]; then
  . /workspace/.context-linux/env.sh
elif [ -d /workspace/.context-toolchain/cargo/bin ]; then
  export CARGO_HOME=/workspace/.context-toolchain/cargo
  export RUSTUP_HOME=/workspace/.context-toolchain/rustup
  export PATH=/workspace/.context-toolchain/cargo/bin:$PATH
fi
export npm_config_cache=${npm_config_cache:-/workspace/.npm-cache}
