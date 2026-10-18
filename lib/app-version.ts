import packageMetadata from "../package.json";

// Single source of truth for the version shown in every DEMIAN CORE signature.
// package.json 1.0.0 displays as V1.0; non-zero patch versions remain visible.
const [major = "1", minor = "0", patch = "0"] = packageMetadata.version.split(".");
export const APP_VERSION = `V${major}.${minor}${patch !== "0" ? `.${patch}` : ""}`;
