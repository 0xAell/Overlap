import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { version: sdkVersion } = require("@farcaster/miniapp-sdk/package.json");
const sdkPath = `/vendor/farcaster-sdk-${sdkVersion}/index.min.js`;
const baseUrl = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";

async function assertJson(path, validate) {
  const response = await fetch(new URL(path, baseUrl));

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const json = await response.json();
  validate(json);
}

async function assertText(path, validate) {
  const response = await fetch(new URL(path, baseUrl));

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  const text = await response.text();
  validate(text);
}

await assertText("/", (text) => {
  if (!text.includes("Overlap")) {
    throw new Error("Home page did not include Overlap branding");
  }

  if (!text.includes("Checking your")) {
    throw new Error("Home page did not render the wallet gate shell");
  }

  if (!text.includes("fc:miniapp")) {
    throw new Error("Home page did not include the fc:miniapp embed metadata");
  }

  if (!text.includes(`src="${sdkPath}"`)) {
    throw new Error("Home page did not include the early Farcaster SDK boot script");
  }

  if (!text.includes("__OVERLAP_MINIAPP_READY__")) {
    throw new Error("Home page did not include the early ready boot marker");
  }
});

const sdkResponse = await fetch(new URL(sdkPath, baseUrl));
const installedSdk = await readFile(
  new URL("dist/index.min.js", import.meta.resolve("@farcaster/miniapp-sdk/package.json")),
);
if (!sdkResponse.ok || !installedSdk.equals(Buffer.from(await sdkResponse.arrayBuffer()))) {
  throw new Error("Hosted Farcaster SDK did not match the installed package");
}

await assertText("/overlap-card.svg", (text) => {
  if (!text.includes("Overlap")) {
    throw new Error("Card asset did not render the expected Overlap label");
  }
});

await assertJson("/.well-known/farcaster.json", (json) => {
  if (!json.accountAssociation) {
    throw new Error("Manifest did not expose accountAssociation");
  }

  if (json.accountAssociation.payload !== "eyJkb21haW4iOiJvdmVybGFwLWZjLndlYi5hcHAifQ") {
    throw new Error("Manifest accountAssociation payload did not match the configured domain");
  }

  if (json.miniapp?.name !== "Overlap") {
    throw new Error("Manifest did not expose the Overlap miniapp metadata");
  }

  const homeUrl = json.miniapp?.homeUrl;
  if (typeof homeUrl !== "string") {
    throw new Error("Manifest did not expose a homeUrl");
  }

  const parsedHomeUrl = new URL(homeUrl);

  if (parsedHomeUrl.origin !== "https://overlap-fc.web.app") {
    throw new Error("Manifest did not point to the expected Firebase Hosting origin");
  }

  if (parsedHomeUrl.searchParams.get("miniApp") !== "true") {
    throw new Error("Manifest homeUrl did not preserve the miniApp=true launch parameter");
  }

  if (!parsedHomeUrl.searchParams.get("v")) {
    throw new Error("Manifest homeUrl did not include a launch version parameter");
  }

  if ((json.miniapp?.subtitle?.length ?? 0) > 30) {
    throw new Error("Manifest subtitle exceeded Farcaster's 30 character limit");
  }

  if ((json.miniapp?.tagline?.length ?? 0) > 30) {
    throw new Error("Manifest tagline exceeded Farcaster's 30 character limit");
  }

  if (!json.miniapp?.requiredCapabilities?.includes("wallet.getEthereumProvider")) {
    throw new Error("Manifest did not declare wallet.getEthereumProvider capability");
  }
});

console.log("smoke ok");
