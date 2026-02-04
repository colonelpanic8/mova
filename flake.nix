{
  description = "Mova - Mobile org-agenda client";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nixgl.url = "github:nix-community/nixGL";
    org-agenda-api.url = "github:colonelpanic8/org-agenda-api";
  };
  outputs = inputs @ {
    self,
    nixpkgs,
    flake-utils,
    nixgl,
    org-agenda-api,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          android_sdk.accept_license = true;
        };
        overlays = [nixgl.overlay];
      };
      nodejs = pkgs.nodejs_22;
      buildToolsVersion = "36.0.0";
      cmdLineToolsVersion = "8.0";
      androidComposition = pkgs.androidenv.composeAndroidPackages {
        cmdLineToolsVersion = cmdLineToolsVersion;
        toolsVersion = "26.1.1";
        platformToolsVersion = "35.0.2";
        buildToolsVersions = [buildToolsVersion "35.0.0" "34.0.0"];
        includeEmulator = true;
        platformVersions = ["35" "36"];
        includeSources = false;
        includeSystemImages = true;
        systemImageTypes = ["google_apis_playstore"];
        abiVersions = ["x86_64"];
        includeNDK = true;
        ndkVersions = ["27.1.12297006" "27.0.12077973" "26.1.10909125"];
        cmakeVersions = ["3.22.1"];
        useGoogleAPIs = true;
        useGoogleTVAddOns = false;
      };
      android-sdk = androidComposition.androidsdk;
      android-home = "${androidComposition.androidsdk}/libexec/android-sdk";
      aapt2Binary = "${android-home}/build-tools/${buildToolsVersion}/aapt2";
      sharedDeps = with pkgs; [
        nodejs
        yarn
        watchman
        alejandra
        just
      ];
    in {
      devShells = {
        android = pkgs.mkShell {
          buildInputs =
            sharedDeps
            ++ [pkgs.jdk17]
            ++ (
              if system == "x86_64-linux"
              then [pkgs.nixgl.auto.nixGLDefault pkgs.nixgl.nixGLIntel]
              else []
            );
          LC_ALL = "en_US.UTF-8";
          LANG = "en_US.UTF-8";
          ANDROID_HOME = android-home;
          ANDROID_SDK_ROOT = android-home;
          GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${aapt2Binary}";
          shellHook = ''
            export JAVA_HOME=${pkgs.jdk17.home}
            export PATH=${android-home}/emulator:${android-home}/cmdline-tools/${cmdLineToolsVersion}/bin:$(pwd)/node_modules/.bin:$PATH
            export ORG_AGENDA_API_DIR="${org-agenda-api}"
            echo "Mova Android dev shell"
            echo "  node: $(node --version)"
            echo "  yarn: $(yarn --version)"
            echo ""
            echo "Commands:"
            echo "  yarn start       - Start Expo dev server"
            echo "  yarn android     - Run on Android"
            echo "  yarn web         - Run in browser"
            echo "  just emulator    - Start Android emulator"
            echo "  just --list      - Show all just commands"
          '';
        };
        ios = (pkgs.mkShell.override {stdenv = pkgs.stdenvNoCC;}) {
          disallowedRequisites = [pkgs.xcbuild pkgs.xcbuild.xcrun];
          buildInputs = sharedDeps ++ [pkgs.cocoapods pkgs.ruby pkgs.bundler];
          LC_ALL = "en_US.UTF-8";
          LANG = "en_US.UTF-8";
          shellHook = ''
            unset DEVELOPER_DIR
            export PATH="$PWD/node_modules/.bin:$PWD/vendor/bundle/bin:$PATH"
            export ORG_AGENDA_API_DIR="${org-agenda-api}"
            export BUNDLE_PATH="$PWD/vendor/bundle"
            export GEM_HOME="$PWD/vendor/bundle"
            echo "Mova iOS dev shell"
            echo "  node: $(node --version)"
            echo "  yarn: $(yarn --version)"
            echo "  ruby: $(ruby --version)"
            echo ""
            echo "Commands:"
            echo "  yarn start       - Start Expo dev server"
            echo "  yarn ios         - Run on iOS"
            echo "  yarn web         - Run in browser"
            echo "  just --list      - Show all just commands"
            echo ""
            echo "Fastlane:"
            echo "  bundle install   - Install fastlane dependencies"
            echo "  bundle exec fastlane archive - Build iOS archive"
          '';
        };
        default = pkgs.mkShell {
          buildInputs = sharedDeps;
          LC_ALL = "en_US.UTF-8";
          LANG = "en_US.UTF-8";
          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
            export ORG_AGENDA_API_DIR="${org-agenda-api}"
            echo "Mova dev shell (use 'nix develop .#ios' or 'nix develop .#android' for platform-specific shells)"
            echo "  node: $(node --version)"
            echo "  yarn: $(yarn --version)"
          '';
        };
      };
    });
}
