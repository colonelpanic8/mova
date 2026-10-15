# Linux desktop app: an Electron window around the static web export.
{
  lib,
  stdenvNoCC,
  electron,
  imagemagick,
  makeWrapper,
  makeDesktopItem,
  copyDesktopItems,
  mova-web,
}:
stdenvNoCC.mkDerivation {
  pname = "mova-desktop";
  inherit (mova-web) version;

  src = ./desktop;

  nativeBuildInputs = [makeWrapper copyDesktopItems imagemagick];

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

    mkdir -p $out/share/mova
    cp main.js package.json $out/share/mova/

    # The app icon pads the logo for Android's adaptive masks; crop that away
    # so it stays legible at panel sizes. hicolor only indexes up to 512x512.
    for size in 16 22 24 32 48 64 96 128 256 512; do
      dir=$out/share/icons/hicolor/''${size}x''${size}/apps
      mkdir -p $dir
      magick ${../assets/images/mova-icon-final.png} -gravity center \
        -crop 640x640+0+0 +repage -resize ''${size}x''${size} $dir/mova.png
    done

    makeWrapper ${lib.getExe electron} $out/bin/mova \
      --add-flags $out/share/mova \
      --set MOVA_WEB_ROOT ${mova-web} \
      --set MOVA_ICON $out/share/icons/hicolor/512x512/apps/mova.png

    runHook postInstall
  '';

  meta = {
    description = "Mova desktop client for org-agenda-api";
    homepage = "https://github.com/colonelpanic8/mova";
    mainProgram = "mova";
    platforms = lib.platforms.linux;
  };
}
