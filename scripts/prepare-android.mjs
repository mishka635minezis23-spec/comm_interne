import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidDir = path.join(root, "android");
const appDir = path.join(androidDir, "app");
const isWindows = process.platform === "win32";
const npx = isWindows ? "npx.cmd" : "npx";

function run(args) {
  execFileSync(npx, args, { cwd: root, stdio: "inherit", shell: isWindows });
}

if (!existsSync(path.join(appDir, "build.gradle"))) {
  run(["cap", "add", "android"]);
}

const nativeSource = path.join(root, "native-android", "src", "main", "java", "org", "ujadiongd", "accueil");
const javaTarget = path.join(appDir, "src", "main", "java", "org", "ujadiongd", "accueil");
mkdirSync(javaTarget, { recursive: true });

for (const file of readdirSync(nativeSource)) {
  if (file.endsWith(".java")) {
    copyFileSync(path.join(nativeSource, file), path.join(javaTarget, file));
  }
}


const appGradlePath = path.join(appDir, "build.gradle");
let appGradle = readFileSync(appGradlePath, "utf8");
if (!appGradle.includes("com.google.firebase:firebase-messaging")) {
  appGradle = appGradle.replace(
    /dependencies\s*\{/,
    match => match + '\n    implementation "com.google.firebase:firebase-messaging:25.0.1"'
  );
  writeFileSync(appGradlePath, appGradle, "utf8");
}

const manifestPath = path.join(appDir, "src", "main", "AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");

if (!manifest.includes("xmlns:tools=")) {
  manifest = manifest.replace("<manifest ", '<manifest xmlns:tools="http://schemas.android.com/tools" ');
}

const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK"
];

for (const permission of permissions) {
  if (!manifest.includes('android:name="' + permission + '"')) {
    manifest = manifest.replace("</manifest>",
      '    <uses-permission android:name="' + permission + '" />\n</manifest>');
  }
}

const nativeManifest = [
  '<service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />',
  '<service android:name="org.ujadiongd.accueil.UjadiMessagingService" android:exported="false">',
  '  <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>',
  '</service>',
  '<service android:name="org.ujadiongd.accueil.AlertSoundService" android:exported="false" android:foregroundServiceType="mediaPlayback" />',
  '<receiver android:name="org.ujadiongd.accueil.AlertActionReceiver" android:exported="false" />'
].join("\n");

if (!manifest.includes("org.ujadiongd.accueil.UjadiMessagingService")) {
  manifest = manifest.replace("</application>", nativeManifest + "\n</application>");
}
writeFileSync(manifestPath, manifest, "utf8");

const javaRoot = path.join(appDir, "src", "main", "java");
function findMainActivity(dir) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === "MainActivity.java") {
      return full;
    }
  }
  return null;
}

const mainActivityPath = findMainActivity(javaRoot);
if (!mainActivityPath) throw new Error("MainActivity.java introuvable dans le projet Android généré.");

let mainActivity = readFileSync(mainActivityPath, "utf8");
if (!mainActivity.includes("registerPlugin(UJADIAlertsPlugin.class)")) {
  if (!mainActivity.includes("import android.os.Bundle;")) {
    mainActivity = mainActivity.replace(/package [^;]+;/, match => match + "\n\nimport android.os.Bundle;\nimport android.content.Intent;\nimport org.ujadiongd.accueil.UJADIAlertsPlugin;");
  }
  mainActivity = mainActivity.replace(
    /public class MainActivity extends BridgeActivity\s*\{/,
    'public class MainActivity extends BridgeActivity {\n' +
    '    @Override\n' +
    '    public void onCreate(Bundle savedInstanceState) {\n' +
    '        registerPlugin(UJADIAlertsPlugin.class);\n' +
    '        super.onCreate(savedInstanceState);\n' +
    '    }\n' +
    '    @Override\n' +
    '    protected void onNewIntent(Intent intent) {\n' +
    '        super.onNewIntent(intent);\n' +
    '        setIntent(intent);\n' +
    '    }\n'
  );
  writeFileSync(mainActivityPath, mainActivity, "utf8");
}

run(["cap", "sync", "android"]);
console.log("Projet Android Capacitor préparé avec le service d'alerte UJADI.");
