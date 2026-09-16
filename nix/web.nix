# Static web export of the app, for serving from a plain HTTP server.
{
  lib,
  stdenvNoCC,
  fetchYarnDeps,
  yarnConfigHook,
  nodejs_22,
  # Path prefix the bundle will be served under, e.g. "/app". Baked into the
  # export's asset and route URLs, so it has to match the server's location.
  baseUrl ? "",
  # Commit recorded in the app's build info; the tree has no .git here.
  gitCommit ? "unknown",
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "mova-web";
  version = (lib.importJSON ../package.json).version;

  src = lib.cleanSourceWith {
    src = ../.;
    filter = path: type: let
      base = baseNameOf path;
    in
      !(builtins.elem base ["android" "ios" "node_modules" "dist" ".expo"]);
  };

  offlineCache = fetchYarnDeps {
    yarnLock = ../yarn.lock;
    hash = "sha256-AvUs7OCCja+a70B7Hwhkbkj4WgzZXYdKdqwJ3JzBZpY=";
  };

  nativeBuildInputs = [yarnConfigHook nodejs_22];

  env = {
    EXPO_NO_TELEMETRY = "1";
    MOVA_GIT_COMMIT = gitCommit;
    MOVA_WEB_BASE_URL = baseUrl;
  };

  buildPhase = ''
    runHook preBuild

    # yarnConfigHook installs with --ignore-scripts, so the postinstall that
    # normally applies patches/ has to run explicitly.
    node_modules/.bin/patch-package

    node_modules/.bin/expo export --platform web --output-dir dist

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r dist $out
    runHook postInstall
  '';

  meta = {
    description = "Mova web client, exported as static files";
    homepage = "https://github.com/colonelpanic8/mova";
    platforms = lib.platforms.all;
  };
})
