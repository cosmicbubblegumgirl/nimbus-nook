$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $Root)
$Workspace = Split-Path -Parent $Repo
$Sdk = Join-Path $Workspace "android-sdk"
$BuildTools = Join-Path $Sdk "build-tools\35.0.0"
$AndroidJar = Join-Path $Sdk "platforms\android-35\android.jar"
$JavaHome = Join-Path $Workspace "tools\temurin17\jdk-17.0.19+10"
$CompileJavaHome = Join-Path $Workspace "tools\temurin8\jdk8u482-b08"

$Aapt = Join-Path $BuildTools "aapt.exe"
$Aapt2 = Join-Path $BuildTools "aapt2.exe"
$D8 = Join-Path $BuildTools "d8.bat"
$ZipAlign = Join-Path $BuildTools "zipalign.exe"
$ApkSigner = Join-Path $BuildTools "apksigner.bat"
$Javac = Join-Path $CompileJavaHome "bin\javac.exe"
$Keytool = Join-Path $JavaHome "bin\keytool.exe"

foreach ($Path in @($AndroidJar, $Aapt, $Aapt2, $D8, $ZipAlign, $ApkSigner, $Javac, $Keytool)) {
    if (!(Test-Path $Path)) {
        throw "Required Android build tool missing: $Path"
    }
}

$env:JAVA_HOME = $JavaHome
$env:PATH = (Join-Path $JavaHome "bin") + ";" + $env:PATH

$BuildDir = Join-Path $Root "build"
$GeneratedDir = Join-Path $BuildDir "generated"
$ClassesDir = Join-Path $BuildDir "classes"
$DexDir = Join-Path $BuildDir "dex"
$CompiledDir = Join-Path $BuildDir "compiled"
$CompileAndroidJar = Join-Path $BuildDir "android.jar"
$ResZip = Join-Path $CompiledDir "resources.zip"
$UnsignedApk = Join-Path $BuildDir "nimbus-nook-unsigned.apk"
$WithDexApk = Join-Path $BuildDir "nimbus-nook-with-dex.apk"
$AlignedApk = Join-Path $BuildDir "nimbus-nook-aligned.apk"
$Keystore = Join-Path $BuildDir "debug.keystore"
$FinalApk = Join-Path $BuildDir "NimbusNook-debug.apk"
$DistDir = Join-Path $Repo "dist"
$DistApk = Join-Path $DistDir "NimbusNook-debug.apk"

$ResolvedRoot = [System.IO.Path]::GetFullPath($Root)
$ResolvedBuild = [System.IO.Path]::GetFullPath($BuildDir)
if (!$ResolvedBuild.StartsWith($ResolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean build directory outside mobile/android."
}

if (Test-Path $BuildDir) {
    Remove-Item -LiteralPath $BuildDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $GeneratedDir, $ClassesDir, $DexDir, $CompiledDir, $DistDir | Out-Null
Copy-Item -LiteralPath $AndroidJar -Destination $CompileAndroidJar -Force

& $Aapt2 compile --dir (Join-Path $Root "app\src\main\res") -o $ResZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed." }

& $Aapt2 link `
    -o $UnsignedApk `
    -I $AndroidJar `
    --manifest (Join-Path $Root "app\src\main\AndroidManifest.xml") `
    --java $GeneratedDir `
    -A (Join-Path $Root "app\src\main\assets") `
    -R $ResZip `
    --auto-add-overlay `
    --min-sdk-version 23 `
    --target-sdk-version 35
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed." }

$Sources = @()
$Sources += Get-ChildItem -Path (Join-Path $Root "app\src\main\java") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$Sources += Get-ChildItem -Path $GeneratedDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }

& $Javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $CompileAndroidJar -d $ClassesDir $Sources
if ($LASTEXITCODE -ne 0) { throw "javac failed." }

$ClassFiles = Get-ChildItem -Path $ClassesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& $D8 --lib $CompileAndroidJar --output $DexDir $ClassFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed." }

Copy-Item -LiteralPath $UnsignedApk -Destination $WithDexApk -Force
Push-Location $DexDir
try {
    & $Aapt add $WithDexApk "classes.dex"
    if ($LASTEXITCODE -ne 0) { throw "aapt add classes.dex failed." }
} finally {
    Pop-Location
}

& $ZipAlign -f 4 $WithDexApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed." }

& $Keytool -genkeypair -keystore $Keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "debug keystore creation failed." }

& $ApkSigner sign --ks $Keystore --ks-pass pass:android --key-pass pass:android --out $FinalApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "APK signing failed." }

& $ApkSigner verify --verbose $FinalApk
if ($LASTEXITCODE -ne 0) { throw "APK verification failed." }

Copy-Item -LiteralPath $FinalApk -Destination $DistApk -Force
Write-Host "Built $DistApk"
