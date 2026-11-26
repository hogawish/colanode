import fs from 'node:fs';
import path from 'node:path';

type ProfileApp = {
  getPath: (name: 'appData') => string;
  setPath: (name: 'userData', value: string) => void;
};

// Keep the preview's existing profile when its displayed product name changes.
// This must run before path/bootstrap services or Chromium capture userData.
export const preservePreviewProfile = (app: ProfileApp): void => {
  const directory = path.join(app.getPath('appData'), 'Colanode');
  fs.mkdirSync(directory, { recursive: true });
  app.setPath('userData', directory);
};
