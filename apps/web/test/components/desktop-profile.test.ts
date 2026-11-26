// The filesystem behavior is tested without starting Electron or opening a real profile.
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, expect, it } from 'vitest';

import { preservePreviewProfile } from '../../../desktop/src/main/profile';

const fixtures: string[] = [];
const root = path.resolve('test');
const fixture = () => {
  const directory = fs.mkdtempSync(path.join(root, '.desktop-profile-'));
  fixtures.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    if (!directory.startsWith(root + path.sep))
      throw new Error('Fixture outside test directory');
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

it('creates a first-run profile before asking Electron to use it', () => {
  const appData = fixture();
  let selected: string | undefined;
  preservePreviewProfile({
    getPath: () => appData,
    setPath: (name, directory) => {
      expect(name).toBe('userData');
      expect(fs.statSync(directory).isDirectory()).toBe(true);
      selected = directory;
    },
  });
  expect(selected).toBe(path.join(appData, 'Colanode'));
});

it('keeps the existing database and bootstrap instead of starting an empty renamed profile', () => {
  const appData = fixture();
  const existing = path.join(appData, 'Colanode');
  fs.mkdirSync(existing);
  fs.writeFileSync(
    path.join(existing, 'app.db'),
    'existing synthetic database'
  );
  fs.writeFileSync(path.join(existing, 'bootstrap.json'), '{"theme":"dark"}');
  let selected: string | undefined;
  const app = {
    getPath: () => appData,
    setPath: (_name: 'userData', value: string) => {
      selected = value;
    },
  };
  preservePreviewProfile(app);
  preservePreviewProfile(app);
  expect(selected).toBe(existing);
  expect(fs.readFileSync(path.join(existing, 'app.db'), 'utf8')).toBe(
    'existing synthetic database'
  );
  expect(fs.readFileSync(path.join(existing, 'bootstrap.json'), 'utf8')).toBe(
    '{"theme":"dark"}'
  );
  expect(fs.existsSync(path.join(appData, 'Tsuzunowa'))).toBe(false);
});
