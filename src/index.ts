import TurboNodeClient from "./node/index.js";
import { TurboSettings } from "./types/turboTypes.js";
import TurboWebClient from "./web/index.js";

export class TurboFactory {
  static init(settings: TurboSettings = {}) {
    if (
      typeof window !== "undefined" &&
      typeof window.document !== "undefined"
    ) {
      return new TurboWebClient(settings);
    } else if (
      typeof global !== "undefined" &&
      global.process &&
      global.process.versions &&
      global.process.versions.node
    ) {
      return new TurboNodeClient(settings);
    } else {
      throw new Error("Unknown environment.");
    }
  }
}
