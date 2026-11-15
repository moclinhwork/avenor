#!/usr/bin/env bash
# Build APK Avenor không cần Gradle (Ubuntu: android-sdk-platform-23, android-sdk-build-tools,
# dalvik-exchange, apksigner, zipalign, JDK).
#   KEYSTORE=... KEYPASS=... bash android/build.sh
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk
JAR=$SDK/platforms/android-23/android.jar
OUT=build
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/gen"

aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$JAR" -F "$OUT/unsigned.apk" --min-sdk-version 23 --target-sdk-version 34
javac -source 8 -target 8 -nowarn -Xlint:-options -encoding UTF-8 -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')
dalvik-exchange --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && zip -q unsigned.apk classes.dex)
zipalign -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KEYPASS" --key-pass "pass:$KEYPASS" --out "$OUT/avenor.apk" "$OUT/aligned.apk"
apksigner verify --print-certs "$OUT/avenor.apk" | head -2
echo "APK: $(pwd)/$OUT/avenor.apk"
