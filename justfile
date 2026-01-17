# Mova development commands

# Start the Android emulator with nixGL
emulator:
    nixGLIntel emulator @mova_test -no-snapshot -no-boot-anim

# Start emulator in background
emulator-bg:
    nixGLIntel emulator @mova_test -no-snapshot -no-boot-anim &

# Build Android app for emulator (x86_64)
build-android:
    cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -DtestBuildType=debug -PreactNativeArchitectures=x86_64

# Build Android app for device (arm64)
build-android-device:
    cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest -DtestBuildType=debug -PreactNativeArchitectures=arm64-v8a

# Build Android release APK (arm64)
release-android:
    cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a

# Clean Android build
clean-android:
    cd android && ./gradlew clean

# Start test API container
test-api-start:
    ./e2e/local-api.sh start

# Stop test API container
test-api-stop:
    ./e2e/local-api.sh stop

# Run all E2E tests
e2e:
    yarn detox test --configuration android.att.debug

# Run agenda E2E tests
e2e-agenda:
    yarn detox test --configuration android.att.debug e2e/agenda.test.ts

# Run scheduling E2E tests
e2e-scheduling:
    yarn detox test --configuration android.att.debug e2e/scheduling.test.ts

# List connected devices
devices:
    adb devices
