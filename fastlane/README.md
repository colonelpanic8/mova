fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### sync

```sh
[bundle exec] fastlane sync
```

Synchronize ios version numbers with package.json

### bump_files

```sh
[bundle exec] fastlane bump_files
```

Bump semantic version

### bump

```sh
[bundle exec] fastlane bump
```

Bump, commit and tag

### bump_build_number

```sh
[bundle exec] fastlane bump_build_number
```

Bump build number only if needed

### connect_api_key

```sh
[bundle exec] fastlane connect_api_key
```



### create_mova_keychain

```sh
[bundle exec] fastlane create_mova_keychain
```



### configure_ios

```sh
[bundle exec] fastlane configure_ios
```

Set up api key, create keychain and match

### build

```sh
[bundle exec] fastlane build
```

Build without signing (for testing)

### archive

```sh
[bundle exec] fastlane archive
```

Build an ios archive

### testflight_latest

```sh
[bundle exec] fastlane testflight_latest
```

Testflight latest

### ci_archive

```sh
[bundle exec] fastlane ci_archive
```

ci_runner

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
