import { useEffect, useState } from 'react';

import { AppInitOutput, AppType } from '@colanode/client/types';
import { build } from '@colanode/core';
import { collections } from '@colanode/ui/collections';
import { AppAssets } from '@colanode/ui/components/app/app-assets';
import { AppLayout } from '@colanode/ui/components/app/app-layout';
import { AppLoading } from '@colanode/ui/components/app/app-loading';
import { AppReset } from '@colanode/ui/components/app/app-reset';
import { AppStartupError } from '@colanode/ui/components/app/app-startup-error';
import { AppThemeProvider } from '@colanode/ui/components/app/app-theme-provider';
import { RadarProvider } from '@colanode/ui/components/app/radar-provider';
import { AppContext } from '@colanode/ui/contexts/app';

interface AppProviderProps {
  type: AppType;
}

export const AppProvider = ({ type }: AppProviderProps) => {
  const [initOutput, setInitOutput] = useState<AppInitOutput | null>(null);

  useEffect(() => {
    console.log(`Colanode | Version: ${build.version} | SHA: ${build.sha}`);

    let active = true;
    const timer = setTimeout(() => {
      if (active) setInitOutput('error');
    }, 20_000);
    const initialize = async () => {
      try {
        const output = await window.colanode.init();
        if (output === 'success') await collections.preload();
        if (active) setInitOutput(output);
      } catch (error) {
        console.error('Colanode | Error opening workspace', error);
        if (active) setInitOutput('error');
      } finally {
        clearTimeout(timer);
      }
    };
    void initialize();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <AppContext.Provider value={{ type }}>
      <AppThemeProvider init={initOutput}>
        <AppAssets />
        {initOutput === null && <AppLoading />}
        {initOutput === 'reset' && <AppReset />}
        {initOutput === 'error' && <AppStartupError />}
        {initOutput === 'success' && (
          <RadarProvider>
            <AppLayout type={type} />
          </RadarProvider>
        )}
      </AppThemeProvider>
    </AppContext.Provider>
  );
};
