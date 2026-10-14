# Linux desktop app: an Electron window around the static web export.
{
  lib,
  stdenvNoCC,
  electron,
  makeWrapper,
  makeDesktopItem,
  copyDesktopItems,
  mova-web,
}:
stdenvNoCC.mkDerivation {
  pname = "mova-desktop";
  inherit (mova-web) version;

  src = ./desktop;

  nativeBuildInputs = [makeWrapper copyDesktopItems];

  desktopItems = [
    (makeDesktopItem {
      name = "mova";
      desktopName = "Mova";
      genericName = "Org Agenda Client";
      comment = "Org-mode agenda, capture, and notes";
      exec = "mova";
      icon = "mova";
      startupWMClass = "mova";
      categories = ["Office" "ProjectManagement"];
    })
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/mova $out/share/icons/hicolor/1024x1024/apps
    cp main.js package.json $out/share/mova/
    cp ${../assets/images/mova-icon-final.png} $out/share/icons/hicolor/1024x1024/apps/mova.png

    makeWrapper ${lib.getExe electron} $out/bin/mova \
      --add-flags $out/share/mova \
      --set MOVA_WEB_ROOT ${mova-web} \
      --set MOVA_ICON $out/share/icons/hicolor/1024x1024/apps/mova.png

    runHook postInstall
  '';

  meta = {
    description = "Mova desktop client for org-agenda-api";
    homepage = "https://github.com/colonelpanic8/mova";
    mainProgram = "mova";
    platforms = lib.platforms.linux;
  };
}
