{
  description = "Sample Nix ts-node build";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    gitignore = {
      url = "github:hercules-ci/gitignore.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    secrets = {
      url = "git+ssh://gitea@dev.railbird.ai:1123/railbird/secrets-flake.git";
    };
    container-utils = {
      url = "git+ssh://gitea@dev.railbird.ai:1123/railbird/static-yarn-nginx-container.git";
    };
    nixgl.url = "github:nix-community/nixGL";
  };
  outputs = inputs @ {
    self,
    nixpkgs,
    flake-utils,
    nixgl,
    gitignore,
    container-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        config = {
          android_sdk.accept_license = true;
        };
        overlays = [nixgl.overlay];
      };
      nodejs = pkgs.nodejs-18_x;
      cmakeVersion = "3.22.1";
      buildToolsVersion = "34.0.0";
      gems = pkgs.bundlerEnv {
        name = "railbird-fastlane-environment";
        gemfile = ./Gemfile;
        lockfile = ./Gemfile.lock;
        gemset = ./gemset.nix;
      };
      sharedDeps = with pkgs; [
        alejandra
        gems
        just
        nodePackages.prettier
        nodejs
        openssl
        rubocop
        typescript
        yarn
        bundix
        sentry-cli
        kubernetes-helm
        kubectl
        (google-cloud-sdk.withExtraComponents [google-cloud-sdk.components.gke-gcloud-auth-plugin])
      ];
      cmdLineToolsVersion = "8.0";
      androidComposition = pkgs.androidenv.composeAndroidPackages {
        cmdLineToolsVersion = cmdLineToolsVersion;
        toolsVersion = "26.1.1";
        platformToolsVersion = "34.0.5";
        buildToolsVersions = ["30.0.3" "33.0.1" buildToolsVersion];
        includeEmulator = true;
        platformVersions = ["30" "33" "34"];
        includeSources = false;
        includeSystemImages = true;
        systemImageTypes = ["google_apis_playstore"];
        abiVersions = ["x86-64" "x86_64"];
        cmakeVersions = [cmakeVersion];
        includeNDK = true;
        ndkVersions = ["23.1.7779620" "25.1.8937393" "26.1.10909125"];
        useGoogleAPIs = true;
        useGoogleTVAddOns = false;
        includeExtras = [
          "extras;google;gcm"
        ];
      };
      android-sdk = androidComposition.androidsdk;
      android-home = "${androidComposition.androidsdk}/libexec/android-sdk";
      cmakeDir = "${android-home}/cmake/${cmakeVersion}/bin";
      nodeBinPath = "${nodejs}/bin";
      emulator = "${android-home}/emulator";
      cmdLineTools = "${android-home}/cmdline-tools/${cmdLineToolsVersion}/bin";
      additionalPath = builtins.concatStringsSep ":" [cmakeDir nodeBinPath emulator cmdLineTools];
      aapt2Binary = "${android-home}/build-tools/${buildToolsVersion}/aapt2";
      setFastlanePasswords = ''
        export FASTLANE_PASSWORD="$(cat $RB_SECRET_APPLE_PASSWORD)"
        export MATCH_KEYCHAIN_PASSWORD="$(cat $RB_SECRET_APPLE_PASSWORD)"
        export MATCH_PASSWORD="$(cat $RB_SECRET_APPLE_PASSWORD)"
        export NODE_BINARY=$(which node)
        export RCT_NO_LAUNCH_PACKAGER=1
      '';
      railbird-mobile-git-commit =
        if (self ? rev)
        then self.rev
        else self.dirtyRev;

      package-name = (builtins.fromJSON (builtins.readFile ./package.json)).name;
      package-version = (builtins.fromJSON (builtins.readFile ./package.json)).version;

      npSrc = container-utils.lib.${system}.mkNpSrc ./.;
    in
      with pkgs; rec {
        packages = rec {
          node_modules = pkgs.mkYarnModules rec {
            pname = package-name;
            version = package-version;
            packageJSON = "${npSrc}/package.json";
            yarnLock = "${npSrc}/yarn.lock";
            offlineCache = pkgs.fetchYarnDeps {
              name = "web-deps-offline-cache";
              yarnLock = "${npSrc}/yarn.lock";
              hash = "sha256-i+8lkSmo1vUXRA14wK4NI8+KwOvQBKrpkYgFif4xGxk=";
            };
            postBuild = ''
              cp -r $out/deps/${pname}/node_modules/* $out/node_modules
              rm -r $out/node_modules/railbird-mobile
              pushd $out/node_modules/react-native-video
              tsc && echo "Ran tsc for react-native-video"
              popd
            '';
            ignoreScripts = false;
            pkgConfig = {
              react-native-video = {
                buildInputs = [
                  pkgs.nodePackages.patch-package
                  typescript
                ];
              };
            };
          };
          reactNativeWebPage = pkgs.stdenv.mkDerivation {
            pname = package-name;
            version = package-version;

            src = pkgs.lib.cleanSourceWith {
              src = pkgs.lib.cleanSource self;
              filter = path: type:
                !(baseNameOf path == "flake.nix" || baseNameOf path == "flake.lock" || baseNameOf path == "mime.types");
            };

            nativeBuildInputs = [
              pkgs.yarn
              pkgs.makeWrapper
              pkgs.nodejs
              pkgs.git
              pkgs.typescript
            ];

            # Set up environment to use prebuilt node_modules
            buildInputs = [node_modules];

            buildPhase = ''
              runHook preBuild

              # Use the prebuilt node_modules
              cp -r ${node_modules}/node_modules ./node_modules

              cacheDirectory=$(pwd)/.cache
              mkdir -p $cacheDirectory

              yarn --offline --cache-folder $cacheDirectory expo export --platform web --reset-cache
              runHook postBuild
            '';

            installPhase = ''
              mkdir -p $out
              cp -r dist/* $out/
            '';

            doCheck = false; # Disable checks if not required
          };

          railbird-mobile-web = container-utils.lib.${system}.mkContainer reactNativeWebPage {
            name = "mova-web";
            tag = railbird-mobile-git-commit;
          };
          default = reactNativeWebPage;
        };
        devShells = {
          android = mkShell {
            inputsFrom = [inputs.secrets.devShells.${system}.default];
            buildInputs =
              sharedDeps
              ++ [gradle_8 watchman]
              ++ (
                if system == "x86_64-linux"
                then [pkgs.nixgl.auto.nixGLDefault pkgs.nixgl.nixGLIntel]
                else []
              );
            LC_ALL = "en_US.UTF-8";
            LANG = "en_US.UTF-8";
            CMAKE_DIR = cmakeDir;
            ANDROID_HOME = android-home;
            ANDROID_NDK_ROOT = "${android-home}/ndk-bundle";
            ANDROID_SDK_BIN = android-home;
            GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${aapt2Binary}";
            shellHook =
              ''
                export FASTLANE_PASSWORD="$(cat $RB_SECRET_APPLE_PASSWORD)"
                export JAVA_HOME=${pkgs.jdk17.home};
                source ${android-sdk.out}/nix-support/setup-hook
                export ORG_GRADLE_PROJECT_ANDROID_HOME="$ANDROID_HOME"
                export PATH=${additionalPath}:$(pwd)/node_modules/.bin:$PATH
              ''
              + setFastlanePasswords;
          };
          ios = pkgs.mkShell.override {stdenv = pkgs.stdenvNoCC;} {
            inputsFrom = [inputs.secrets.devShells.${system}.default];
            LC_ALL = "en_US.UTF-8";
            LANG = "en_US.UTF-8";
            NODE_OPTIONS = "--max-old-space-size=8192";
            buildInputs = sharedDeps ++ [cocoapods openssh];
            shellHook = setFastlanePasswords;
          };
        };
        devShell = devShells.android;
      });
}
