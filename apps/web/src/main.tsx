import * as Comlink from 'comlink';
import { createRoot } from 'react-dom/client';

import { eventBus } from '@colanode/client/lib';
import { AppLoading } from '@colanode/ui/components/app/app-loading';
import { AppStartupError } from '@colanode/ui/components/app/app-startup-error';
import { BrowserNotSupported } from '@colanode/web/components/browser-not-supported';
import { MobileNotSupported } from '@colanode/web/components/mobile-not-supported';
import { ColanodeWorkerApi } from '@colanode/web/lib/types';
import { isMobileDevice, isOpfsSupported } from '@colanode/web/lib/utils';
import { Root } from '@colanode/web/root';
import DedicatedWorker from '@colanode/web/workers/dedicated?worker';

const root = createRoot(document.getElementById('root') as HTMLElement);

const initializeApp = async () => {
  root.render(<AppLoading />);
  const isMobile = isMobileDevice();
  if (isMobile) {
    root.render(<MobileNotSupported />);
    return;
  }

  const hasOpfsSupport = await isOpfsSupported();
  if (!hasOpfsSupport) {
    root.render(<BrowserNotSupported />);
    return;
  }

  const worker = new DedicatedWorker();
  const showStartupError = () => root.render(<AppStartupError />);
  worker.addEventListener('error', showStartupError);
  worker.addEventListener('messageerror', showStartupError);
  const workerApi = Comlink.wrap<ColanodeWorkerApi>(worker);

  window.colanode = {
    init: async () => {
      return workerApi.init();
    },
    reset: async () => {
      await workerApi.reset();
      window.location.reload();
    },
    executeMutation: async (input) => {
      return workerApi.executeMutation(input);
    },
    executeQuery: async (input) => {
      return workerApi.executeQuery(input);
    },
    executeQueryAndSubscribe: async (key, input) => {
      return workerApi.executeQueryAndSubscribe(key, input);
    },
    saveTempFile: async (file) => {
      return workerApi.saveTempFile(file);
    },
    unsubscribeQuery: async (queryId) => {
      return workerApi.unsubscribeQuery(queryId);
    },
    openExternalUrl: async (url) => {
      window.open(url, '_blank');
    },
    showItemInFolder: async () => {
      // No-op on web
    },
    showFileSaveDialog: async () => undefined,
  };

  window.eventBus = eventBus;

  workerApi.subscribe(
    Comlink.proxy((event) => {
      eventBus.publish(event);
    })
  );

  root.render(<Root />);
};

initializeApp().catch(() => {
  root.render(<AppStartupError />);
});
