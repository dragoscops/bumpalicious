import {fs, stream} from '../utils/node-wrapper.js';

export function mockNode() {
  vi.spyOn(fs.async, 'access').mockResolvedValue((path) => true);
  vi.spyOn(fs.async, 'readFile').mockImplementation((path) => {
    if (String(path).includes('.new.md')) {
      return Promise.resolve('## 1.0.0 (2023-04-27)\n\n* feat: initial release\n');
    }
    return Promise.resolve('# Changelog\n\nAll notable changes...\n\n## [Unreleased]\n\n');
  });
  vi.spyOn(fs.async, 'writeFile').mockResolvedValue(undefined);
  vi.spyOn(fs.async, 'unlink').mockResolvedValue(undefined);

  vi.spyOn(fs, 'createWriteStream').mockReturnValue({
    pipe: vi.fn(),
  });

  vi.spyOn(stream.async, 'pipeline').mockResolvedValue(undefined);
}

export function unMockNode() {
  fs.async.access.mockRestore();
  fs.async.readFile.mockRestore();
  fs.async.writeFile.mockRestore();
  fs.async.unlink.mockRestore();

  fs.createWriteStream.mockRestore();

  stream.async.pipeline.mockRestore();
}
