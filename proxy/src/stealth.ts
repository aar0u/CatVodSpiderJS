import type { BrowserContext } from "playwright";

// Focused fixes for sites that use DevTools/CDP Error.stack serialization checks.
const LIGHTWEIGHT_STEALTH_SCRIPT = String.raw`
(() => {
  const nativeFunctionStrings = new WeakMap();
  const nativeToString = Function.prototype.toString;
  const markAsNative = (fn, name) => {
    nativeFunctionStrings.set(fn, "function " + name + "() { [native code] }");
  };

  const patchFunctionToString = () => {
    const patchedToString = new Proxy(nativeToString, {
      apply(target, thisArg, args) {
        const nativeString =
          typeof thisArg === "function" ? nativeFunctionStrings.get(thisArg) : null;
        return nativeString || Reflect.apply(target, thisArg, args);
      },
    });

    markAsNative(patchedToString, "toString");
    Function.prototype.toString = patchedToString;
  };

  const sanitizeConsoleArg = (value) => {
    if (value === null) return value;
    const type = typeof value;
    if (type !== "object" && type !== "function") return value;
    if (value instanceof Error) return value.name + ": " + value.message;
    if (Array.isArray(value)) return "[Array]";
    if (type === "function") return "[Function]";
    return "[Object]";
  };

  const patchConsoleSerialization = () => {
    const patchConsoleMethod = (method) => {
      const originalMethod = console[method];
      if (typeof originalMethod !== "function") return;

      const patchedMethod = {
        [method](...args) {
          return originalMethod.apply(console, args.map(sanitizeConsoleArg));
        },
      }[method];

      Object.defineProperty(console, method, {
        value: patchedMethod,
        configurable: true,
        writable: true,
      });
      markAsNative(patchedMethod, method);
    };

    ["debug", "dir", "error", "info", "log", "table", "trace", "warn"].forEach(
      patchConsoleMethod,
    );
  };

  const patchNavigator = () => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-MY", "en-US", "en"],
    });
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
  };

  const patchChromeRuntime = () => {
    if ("chrome" in window) return;
    Object.defineProperty(window, "chrome", { get: () => ({ runtime: {} }) });
  };

  const patchPermissions = () => {
    const originalQuery = navigator.permissions?.query?.bind(navigator.permissions);
    if (!originalQuery) return;

    navigator.permissions.query = function query(parameters) {
      if (parameters.name !== "notifications") return originalQuery(parameters);
      const state =
        Notification.permission === "default" ? "prompt" : Notification.permission;
      return Promise.resolve({ state });
    };
    markAsNative(navigator.permissions.query, "query");
  };

  const patchWebGL = () => {
    const patchPrototype = (prototype) => {
      const getParameter = prototype.getParameter;
      prototype.getParameter = function getParameter(parameter) {
        if (parameter === 37445) return "Intel Inc.";
        if (parameter === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.call(this, parameter);
      };
      markAsNative(prototype.getParameter, "getParameter");
    };

    patchPrototype(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) {
      patchPrototype(WebGL2RenderingContext.prototype);
    }
  };

  patchFunctionToString();
  patchConsoleSerialization();
  patchNavigator();
  patchChromeRuntime();
  patchPermissions();
  patchWebGL();
})();
`;

export async function applyLightweightStealth(context: BrowserContext) {
  await context.addInitScript({ content: LIGHTWEIGHT_STEALTH_SCRIPT });
}
