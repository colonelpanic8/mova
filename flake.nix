{
  description = "Mova - Mobile org-agenda client";
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nixgl.url = "github:nix-community/nixGL";
  };
  outputs = inputs @ {
    self,
    nixpkgs,
    flake-utils,
    nixgl,
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
      nodejs = pkgs.nodejs_22;
      buildToolsVersion = "35.0.0";
      cmdLineToolsVersion = "8.0";
      androidComposition = pkgs.androidenv.composeAndroidPackages {
        cmdLineToolsVersion = cmdLineToolsVersion;
        toolsVersion = "26.1.1";
        platformToolsVersion = "35.0.2";
        buildToolsVersions = [buildToolsVersion "34.0.0"];
        includeEmulator = true;
        platformVersions = ["35"];
        includeSources = false;
        includeSystemImages = true;
        systemImageTypes = ["google_apis_playstore"];
        abiVersions = ["x86_64"];
        includeNDK = true;
        ndkVersions = ["27.0.12077973" "26.1.10909125"];
        cmakeVersions = ["3.22.1"];
        useGoogleAPIs = true;
        useGoogleTVAddOns = false;
      };
      android-sdk = androidComposition.androidsdk;
      android-home = "${androidComposition.androidsdk}/libexec/android-sdk";
      aapt2Binary = "${android-home}/build-tools/${buildToolsVersion}/aapt2";
    in {
      devShells = {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            yarn
            watchman
            alejandra
            jdk17
          ] ++ (
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
            source ${android-sdk.out}/nix-support/setup-hook
            export PATH=${android-home}/emulator:${android-home}/cmdline-tools/${cmdLineToolsVersion}/bin:$(pwd)/node_modules/.bin:$PATH
            echo "Mova dev shell"
            echo "  node: $(node --version)"
            echo "  yarn: $(yarn --version)"
            echo ""
            echo "Commands:"
            echo "  yarn start    - Start Expo dev server"
            echo "  yarn android  - Run on Android"
            echo "  yarn web      - Run in browser"
          '';
        };
      };
    });
}
