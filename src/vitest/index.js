export const mockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (typeof console[key] === "function") {
      console[key] = vi.fn();
    }
  });
};

export const unMockConsole = (keys = []) => {
  (keys.length ? keys : Object.keys(console)).forEach((key) => {
    if (
      typeof console[key] === "function" &&
      typeof console[key].mockRestore === "function"
    ) {
      console[key].mockRestore();
    }
  });
};
